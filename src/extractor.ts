import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import crypto from "crypto"

export type SignalKind =
  | "file_read"
  | "file_path"
  | "import"
  | "function"
  | "class"
  | "route"
  | "command_output"
  | "search_match"
  | "error"
  | "lsp_result"
  | "property"
  | "constant"

const LSP_KIND_MAP: Record<number, { kind: SignalKind; name: string }> = {
  1: { kind: "file_path", name: "File" },
  2: { kind: "function", name: "Module" },
  3: { kind: "function", name: "Namespace" },
  4: { kind: "function", name: "Package" },
  5: { kind: "class", name: "Class" },
  6: { kind: "function", name: "Method" },
  7: { kind: "function", name: "Property" },
  8: { kind: "function", name: "Field" },
  9: { kind: "class", name: "Constructor" },
  10: { kind: "class", name: "Enum" },
  11: { kind: "class", name: "Interface" },
  12: { kind: "function", name: "Function" },
  13: { kind: "function", name: "Variable" },
  14: { kind: "function", name: "Constant" },
}

export type Signal = {
  id: string
  evidenceId: string
  sessionId: string
  kind: SignalKind
  language?: string
  file?: string
  name?: string
  text: string
  lineStart?: number
  lineEnd?: number
  tags: string[]
  confidence: number
  createdAt: number
}

export type Evidence = {
  id: string
  sessionId: string
  tool: string
  input: unknown
  output: string
  createdAt: number
}

export type ParsedFile = {
  file?: string
  contentLines: Array<{ lineNo: number; text: string }>
}

function fileNameTag(file?: string): string[] {
  if (!file) return []
  const ext = path.extname(file).slice(1)
  const base = path.basename(file)
  return ext ? [base, ext] : [base]
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.filter(Boolean))]
}

function makeSignal(evidence: Evidence, data: Partial<Signal>): Signal {
  return {
    id: crypto.randomUUID(),
    evidenceId: evidence.id,
    sessionId: evidence.sessionId,
    kind: data.kind ?? "function",
    language: data.language,
    file: data.file,
    name: data.name,
    text: data.text ?? "",
    lineStart: data.lineStart,
    lineEnd: data.lineEnd,
    tags: data.tags ?? [],
    confidence: data.confidence ?? 0.8,
    createdAt: evidence.createdAt,
  }
}

export function detectLanguage(file?: string): string {
  if (!file) return "unknown"
  const ext = path.extname(file).toLowerCase()
  const lang: Record<string, string> = {
    ".ts": "typescript",
    ".tsx": "typescript",
    ".js": "javascript",
    ".jsx": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".php": "php",
    ".c": "c",
    ".cpp": "cpp",
    ".cs": "csharp",
    ".swift": "swift",
    ".kt": "kotlin",
    ".scala": "scala",
  }
  return lang[ext] ?? "unknown"
}

function parseReadOutput(output: string): ParsedFile {
  const lines = output.split("\n")
  let file: string | undefined

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.startsWith("<path>") && trimmed.endsWith("</path>")) {
      file = trimmed.slice(6, -7)
    }
  }

  const contentLines = lines
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (t.startsWith("<path>") && t.endsWith("</path>")) return false
      if (t === "<content>" || t === "</content>") return false
      return true
    })
    .map((line, i) => {
      const cleaned = line.replace(/^\d+:\s*/, "").trim()
      return { lineNo: i + 1, text: cleaned }
    })
    .filter(({ text }) => text.length > 0)

  return { file, contentLines }
}

function extractLspSignals(evidence: Evidence): Signal[] {
  const output = evidence.output
  const isError = /no lsp server|error|failed|not found/i.test(output)

  if (isError) {
    return [
      makeSignal(evidence, {
        kind: "error",
        text: output.slice(0, 2000),
        tags: cleanTags(["lsp", "error"]),
        confidence: 0.9,
      }),
    ]
  }

  try {
    const parsed = JSON.parse(output)
    
    const signals: Signal[] = []
    
    const processDocumentSymbols = (
      symbols: Array<{
        name: string
        kind?: number
        detail?: string
        range?: { start: { line: number }; end: { line: number } }
        selectionRange?: { start: { line: number } }
        children?: unknown[]
      }>,
      file?: string
    ) => {
      for (const sym of symbols) {
        if (!sym.name) continue
        
        const mapped = sym.kind ? LSP_KIND_MAP[sym.kind] : null
        const signalKind: SignalKind = mapped?.kind ?? "function"
        
        signals.push(
          makeSignal(evidence, {
            kind: signalKind,
            name: sym.name,
            file,
            text: sym.detail
              ? `${sym.name}: ${sym.detail}`
              : `${mapped?.name ?? "Symbol"} ${sym.name}`,
            lineStart: sym.selectionRange?.start?.line ?? sym.range?.start?.line,
            lineEnd: sym.range?.end?.line,
            tags: cleanTags([
              signalKind,
              sym.name,
              file ? file.split(/[/\\]/).pop() : undefined,
            ].filter(Boolean) as string[]),
            confidence: 0.95,
          })
        )
        
        if (sym.children && Array.isArray(sym.children)) {
          processDocumentSymbols(sym.children as typeof symbols, file)
        }
      }
    }

    if (Array.isArray(parsed)) {
      if (parsed.length > 0 && "location" in parsed[0]) {
        for (const sym of parsed) {
          const location = (sym as { location?: { uri?: string; range?: { start: { line: number } } } }).location
          const file = location?.uri
            ? decodeURIComponent(location.uri.replace(/^file:\/\//, ""))
            : undefined
            
          const mapped = sym.kind ? LSP_KIND_MAP[sym.kind] : null
          
          signals.push(
            makeSignal(evidence, {
              kind: mapped?.kind ?? "function",
              name: sym.name,
              file,
              text: `${mapped?.name ?? "Symbol"} ${sym.name}`,
              lineStart: location?.range?.start?.line,
              tags: cleanTags([mapped?.kind ?? "function", sym.name]),
              confidence: 0.95,
            })
          )
        }
      } else {
        processDocumentSymbols(parsed)
      }
    } else if (parsed.result && Array.isArray(parsed.result)) {
      processDocumentSymbols(parsed.result)
    }

    if (signals.length > 0) {
      return signals
    }
  } catch {
    // Not JSON, continue
  }

  return [
    makeSignal(evidence, {
      kind: "lsp_result",
      text: output.slice(0, 2000),
      tags: cleanTags(["lsp", "raw"]),
      confidence: 0.7,
    }),
  ]
}

function extractUsingAST(_evidence: Evidence, _file?: string): Signal[] {
  return []
}

function extractGenericCodeSignals(evidence: Evidence): Signal[] {
  const { file, contentLines } = parseReadOutput(evidence.output)
  const language = detectLanguage(file)
  const signals: Signal[] = []

  if (file) {
    signals.push(
      makeSignal(evidence, {
        kind: "file_read",
        language,
        file,
        text: `Read file ${file}`,
        tags: cleanTags(["file", "read", language, ...fileNameTag(file)]),
        confidence: 1,
      })
    )
  }

  const astSignals = extractUsingAST(evidence, file)
  if (astSignals.length > 0) {
    signals.push(...astSignals)
    return signals
  }

  for (const { lineNo, text } of contentLines) {
    const clean = text.trim()
    if (!clean) continue

    const importPatterns = [
      /^(from\s+[\w.]+\s+import\s+.+)$/,
      /^(import\s+.+)$/,
      /^(const|let|var)\s+.+\s*=\s*require\(.+\)/,
      /^(?:const|let|var)\s+\w+\s*=\s*require\(/,
    ]

    if (importPatterns.some((pattern) => pattern.test(clean))) {
      signals.push(
        makeSignal(evidence, {
          kind: "import",
          language,
          file,
          text: clean,
          lineStart: lineNo,
          lineEnd: lineNo,
          tags: cleanTags(["import", language, ...fileNameTag(file)]),
          confidence: 0.85,
        })
      )
      continue
    }

    const functionPatterns: Array<{ regex: RegExp; group: number }> = [
      { regex: /^(?!await|raise|return|yield|if|elif|else|for|while|try|except|with|as|import|from|pass|break|continue|lambda)(?:async\s+)?def\s+([A-Za-z_][\w]*)\s*\(/, group: 1 },
      { regex: /^(?!await|\.|\(|const|let|var|return|if|for|while|try|catch|import|from|export|class)(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/, group: 1 },
      { regex: /^(?!await|\.|return|\(|if|for|while|try|catch)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/, group: 1 },
      { regex: /^(?!await|\.|return|\(|if|for|while|try|catch)(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*async\s+[A-Za-z_$][\w$]*\s*=>/, group: 1 },
      { regex: /^module\.exports\s*=\s*(?:require\(|[a-zA-Z_]\w*\()/, group: 0 },
      { regex: /^exports\.[a-zA-Z_][\w]*\s*=\s*function/, group: 0 },
      { regex: /^(?!if|for|switch|select|return|go|defer|import|from)func\s+([A-Za-z_][\w]*)\s*\(/, group: 1 },
      { regex: /^(?!if|for|while|return|try|catch|private|public|protected|static)(?:public|private|protected)?\s*(?:static\s+)?[\w<>\[\]]+\s+([A-Za-z_][\w]*)\s*\([^)]*\)\s*[{(]?\s*$/, group: 1 },
    ]

    for (const pattern of functionPatterns) {
      const match = clean.match(pattern.regex)
      const name = match?.[pattern.group]

      if (name) {
        signals.push(
          makeSignal(evidence, {
            kind: "function",
            language,
            file,
            name,
            text: `Function ${name} defined in ${file ?? "unknown file"} at line ${lineNo}`,
            lineStart: lineNo,
            lineEnd: lineNo,
            tags: cleanTags(["function", name, language, ...fileNameTag(file)]),
            confidence: 0.9,
          })
        )
        break
      }
    }

    const classPatterns: Array<{ regex: RegExp; group: number }> = [
      { regex: /^class\s+([A-Za-z_][\w]*)/, group: 1 },
      { regex: /^(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/, group: 1 },
      { regex: /^(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, group: 1 },
      { regex: /^(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/, group: 1 },
    ]

    for (const pattern of classPatterns) {
      const match = clean.match(pattern.regex)
      const name = match?.[pattern.group]

      if (name) {
        signals.push(
          makeSignal(evidence, {
            kind: "class",
            language,
            file,
            name,
            text: `Class/type ${name} defined in ${file ?? "unknown file"} at line ${lineNo}`,
            lineStart: lineNo,
            lineEnd: lineNo,
            tags: cleanTags(["class", name, language, ...fileNameTag(file)]),
            confidence: 0.9,
          })
        )
        break
      }
    }

    const routePatterns: Array<{ regex: RegExp; methodGroup?: number; pathGroup: number }> = [
      {
        regex: /@(router|app)\.(get|post|put|patch|delete|options|head)\(["']([^"']+)["']/,
        methodGroup: 2,
        pathGroup: 3,
      },
      {
        regex: /\b(router|app)\.(get|post|put|patch|delete|options|head)\(["']([^"']+)["']/,
        methodGroup: 2,
        pathGroup: 3,
      },
      {
        regex: /@(Get|Post|Put|Patch|Delete|Options|Head)\(["']?([^"')]*)["']?\)/,
        methodGroup: 1,
        pathGroup: 2,
      },
    ]

    for (const pattern of routePatterns) {
      const match = clean.match(pattern.regex)

      if (match) {
        const method = pattern.methodGroup
          ? match[pattern.methodGroup]?.toUpperCase()
          : "ROUTE"
        const routePath = match[pattern.pathGroup] ?? ""

        signals.push(
          makeSignal(evidence, {
            kind: "route",
            language,
            file,
            name: `${method} ${routePath}`,
            text: `Route ${method} ${routePath} in ${file ?? "unknown file"} at line ${lineNo}`,
            lineStart: lineNo,
            lineEnd: lineNo,
            tags: cleanTags(["route", method, routePath, language, ...fileNameTag(file)]),
            confidence: 0.95,
          })
        )
        break
      }
    }
  }

  return dedupeSignals(signals)
}

function extractGrepSignals(evidence: Evidence): Signal[] {
  const signals: Signal[] = []
  const lines = evidence.output.split("\n")
  let currentFile: string | undefined

  for (const line of lines) {
    const fileMatch = line.match(/^([A-Za-z]:\\.*|\/.*):$/)

    if (fileMatch) {
      currentFile = fileMatch[1]
      continue
    }

    const match = line.match(/^\s*Line\s+(\d+):\s*(.*)$/)

    if (match && currentFile) {
      const lineNo = Number(match[1])
      const text = match[2]

      signals.push(
        makeSignal(evidence, {
          kind: "search_match",
          language: detectLanguage(currentFile),
          file: currentFile,
          text: `Search match in ${currentFile} at line ${lineNo}: ${text}`,
          lineStart: lineNo,
          lineEnd: lineNo,
          tags: cleanTags(["search", "grep", detectLanguage(currentFile), ...fileNameTag(currentFile)]),
          confidence: 0.8,
        })
      )
    }
  }

  return signals
}

function extractGlobSignals(evidence: Evidence): Signal[] {
  return evidence.output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Found "))
    .filter((line) => line.includes("\\") || line.includes("/"))
    .map((file) =>
      makeSignal(evidence, {
        kind: "file_path",
        language: detectLanguage(file),
        file,
        text: `Discovered file ${file}`,
        tags: cleanTags(["file", "path", detectLanguage(file), ...fileNameTag(file)]),
        confidence: 0.7,
      })
    )
}

function extractBashSignals(evidence: Evidence): Signal[] {
  const output = evidence.output.slice(0, 4000)
  const isError = /error|failed|exception|traceback|cannot find|not recognized/i.test(output)

  return [
    makeSignal(evidence, {
      kind: isError ? "error" : "command_output",
      text: output,
      tags: cleanTags(["bash", "command", isError ? "error" : "output"]),
      confidence: isError ? 0.9 : 0.65,
    }),
  ]
}

function dedupeSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>()
  const result: Signal[] = []

  for (const signal of signals) {
    const key = [
      signal.kind,
      signal.file ?? "",
      signal.name ?? "",
      signal.lineStart ?? "",
      signal.text,
    ].join("|")

    if (seen.has(key)) continue
    seen.add(key)
    result.push(signal)
  }

  return result
}

function signalKey(signal: Signal): string {
  return [
    signal.kind,
    signal.file ?? "",
    signal.name ?? "",
    signal.lineStart ?? "",
    signal.text,
  ].join("|")
}

export function extractSignals(evidence: Evidence): Signal[] {
  switch (evidence.tool) {
    case "read":
      return extractGenericCodeSignals(evidence)
    case "grep":
      return extractGrepSignals(evidence)
    case "glob":
      return extractGlobSignals(evidence)
    case "bash":
      return extractBashSignals(evidence)
    case "lsp":
      return extractLspSignals(evidence)
    default:
      return []
  }
}