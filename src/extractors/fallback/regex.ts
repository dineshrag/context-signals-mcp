import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

const BUILTINS = [
  "console", "JSON", "Math", "Date", "Array", "Object", "String", "Number",
  "Boolean", "Promise", "Map", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect",
  "Symbol", "Error", "parseInt", "parseFloat", "isNaN", "isFinite",
  "encodeURI", "decodeURI", "setTimeout", "setInterval", "clearTimeout",
  "clearInterval", "require", "module", "exports", "__dirname", "__filename",
  "HTTPException", "len", "open", "response", "request",
]

const FUNCTION_PATTERN = /(?<![\w])(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g
const ARROW_CONST_PATTERN = /(?<![\w])const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/g
const ARROW_ASYNC_PATTERN = /(?<![\w])const\s+([A-Za-z_$][\w$]*)\s*=\s*async\s+[A-Za-z_$][\w$]*\s*=>/g
const CLASS_PATTERN = /(?<![\w])(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g
const INTERFACE_PATTERN = /(?<![\w])(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/g
const TYPE_PATTERN = /(?<![\w])(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*=/g
const ENUM_PATTERN = /(?<![\w])(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z_$][\w$]*)/g

const IMPORT_PATTERN = /^import\s+(?:(?:\{[^}]*\}|[A-Za-z_$][\w$]*)\s+from\s+)?['"]([^'"]+)['"]/gm
const EXPORT_PATTERN = /^export\s+(?:\{([^}]*)\}|default|function|class|const|let)/gm

const EXPRESS_ROUTE_PATTERN = /(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']\s*,/g
const FASTIFY_ROUTE_PATTERN = /fastify\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']\s*,/g

const REACT_COMPONENT_PATTERN = /(?:export\s+(?:default\s+)?)?(?:function|const)\s+([A-Z][a-zA-Z0-9]*)\s*(?:=|\()/g

export interface RegexExtractorOptions {
  includeRoutes?: boolean
  includeComponents?: boolean
}

export function extractWithRegex(
  content: string,
  file: string,
  evidenceId: string,
  options: RegexExtractorOptions = {}
): Signal[] {
  const signals: Signal[] = []
  const { includeRoutes = true, includeComponents = true } = options

  extractImports(content, file, evidenceId, signals)
  extractExports(content, file, evidenceId, signals)
  extractFunctions(content, file, evidenceId, signals)
  extractClasses(content, file, evidenceId, signals)
  extractInterfaces(content, file, evidenceId, signals)
  extractTypes(content, file, evidenceId, signals)
  extractEnums(content, file, evidenceId, signals)

  if (includeRoutes) {
    extractExpressRoutes(content, file, evidenceId, signals)
    extractFastifyRoutes(content, file, evidenceId, signals)
  }

  if (includeComponents) {
    extractReactComponents(content, file, evidenceId, signals)
  }

  return deduplicateSignals(signals)
}

function extractImports(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = IMPORT_PATTERN.exec(content)) !== null) {
    const [, moduleName] = match
    signals.push(createSignal({
      evidenceId,
      kind: "import",
      language: detectLanguage(file),
      file,
      text: `import from '${moduleName}'`,
      tags: ["import", moduleName],
      confidence: 0.9,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractExports(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = EXPORT_PATTERN.exec(content)) !== null) {
    const exportContent = match[0]
    signals.push(createSignal({
      evidenceId,
      kind: "export",
      language: detectLanguage(file),
      file,
      text: exportContent,
      tags: ["export"],
      confidence: 0.9,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractFunctions(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match

  while ((match = FUNCTION_PATTERN.exec(content)) !== null) {
    const name = match[1]
    if (isBuiltin(name)) continue
    signals.push(createSignal({
      evidenceId,
      kind: "function",
      language: detectLanguage(file),
      file,
      name,
      text: `function ${name}(...)`,
      tags: ["function", name],
      confidence: 0.9,
      lineStart: getLineNumber(content, match.index),
    }))
  }

  FUNCTION_PATTERN.lastIndex = 0

  while ((match = ARROW_CONST_PATTERN.exec(content)) !== null) {
    const name = match[1]
    if (isBuiltin(name)) continue
    signals.push(createSignal({
      evidenceId,
      kind: "function",
      language: detectLanguage(file),
      file,
      name,
      text: `const ${name} = (...) => ...`,
      tags: ["function", "arrow", name],
      confidence: 0.9,
      lineStart: getLineNumber(content, match.index),
    }))
  }

  ARROW_CONST_PATTERN.lastIndex = 0

  while ((match = ARROW_ASYNC_PATTERN.exec(content)) !== null) {
    const name = match[1]
    if (isBuiltin(name)) continue
    signals.push(createSignal({
      evidenceId,
      kind: "function",
      language: detectLanguage(file),
      file,
      name,
      text: `const ${name} = async (...) => ...`,
      tags: ["function", "arrow", "async", name],
      confidence: 0.9,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractClasses(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = CLASS_PATTERN.exec(content)) !== null) {
    const name = match[1]
    signals.push(createSignal({
      evidenceId,
      kind: "class",
      language: detectLanguage(file),
      file,
      name,
      text: `class ${name}`,
      tags: ["class", name],
      confidence: 0.95,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractInterfaces(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = INTERFACE_PATTERN.exec(content)) !== null) {
    const name = match[1]
    signals.push(createSignal({
      evidenceId,
      kind: "interface",
      language: detectLanguage(file),
      file,
      name,
      text: `interface ${name}`,
      tags: ["interface", name],
      confidence: 0.95,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractTypes(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = TYPE_PATTERN.exec(content)) !== null) {
    const name = match[1]
    signals.push(createSignal({
      evidenceId,
      kind: "type",
      language: detectLanguage(file),
      file,
      name,
      text: `type ${name} = ...`,
      tags: ["type", name],
      confidence: 0.95,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractEnums(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = ENUM_PATTERN.exec(content)) !== null) {
    const name = match[1]
    signals.push(createSignal({
      evidenceId,
      kind: "class",
      language: detectLanguage(file),
      file,
      name,
      text: `enum ${name}`,
      tags: ["enum", name],
      confidence: 0.95,
      lineStart: getLineNumber(content, match.index),
    }))
  }
}

function extractExpressRoutes(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = EXPRESS_ROUTE_PATTERN.exec(content)) !== null) {
    const [, method, path] = match
    signals.push(createSignal({
      evidenceId,
      kind: "route",
      language: detectLanguage(file),
      file,
      name: `${method.toUpperCase()} ${path}`,
      text: `${method.toUpperCase()} ${path}`,
      tags: ["route", method.toUpperCase(), path, "express"],
      confidence: 0.85,
      lineStart: getLineNumber(content, match.index),
      framework: "express",
      route: { method: method.toUpperCase(), path },
    }))
  }
}

function extractFastifyRoutes(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  let match
  while ((match = FASTIFY_ROUTE_PATTERN.exec(content)) !== null) {
    const [, method, path] = match
    signals.push(createSignal({
      evidenceId,
      kind: "route",
      language: detectLanguage(file),
      file,
      name: `${method.toUpperCase()} ${path}`,
      text: `${method.toUpperCase()} ${path}`,
      tags: ["route", method.toUpperCase(), path, "fastify"],
      confidence: 0.85,
      lineStart: getLineNumber(content, match.index),
      framework: "fastify",
      route: { method: method.toUpperCase(), path },
    }))
  }
}

function extractReactComponents(content: string, file: string, evidenceId: string, signals: Signal[]): void {
  if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return

  let match
  while ((match = REACT_COMPONENT_PATTERN.exec(content)) !== null) {
    const name = match[1]
    if (!isComponentName(name)) continue

    signals.push(createSignal({
      evidenceId,
      kind: "component",
      language: detectLanguage(file),
      file,
      name,
      text: `Component ${name}`,
      tags: ["component", name, "react"],
      confidence: 0.85,
      lineStart: getLineNumber(content, match.index),
      framework: "react",
    }))
  }
}

function isBuiltin(name: string): boolean {
  return BUILTINS.includes(name)
}

function isComponentName(name: string): boolean {
  if (!name) return false
  if (name.charAt(0) !== name.charAt(0).toUpperCase()) return false
  if (name.startsWith("_") || name.startsWith("use") || name.startsWith("set")) return false
  return !isBuiltin(name)
}

function detectLanguage(file: string): "typescript" | "javascript" {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase()
  if (ext === ".ts" || ext === ".tsx") return "typescript"
  return "javascript"
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length
}

function deduplicateSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>()
  return signals.filter(signal => {
    const key = [signal.kind, signal.file ?? "", signal.name ?? "", signal.lineStart ?? "", signal.text].join("|")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}