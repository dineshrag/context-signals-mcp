import ts from "typescript"
import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

const FRAMEWORK = "react" as const

export function extractReactComponents(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []

  if (!isReactFile(file)) return signals

  try {
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    walkAST(sourceFile, evidenceId, file, signals)
  } catch {
    return extractReactComponentsRegex(content, file, evidenceId)
  }

  return signals
}

function isReactFile(file: string): boolean {
  return file.endsWith(".tsx") || file.endsWith(".jsx") || file.endsWith(".ts") || file.endsWith(".js")
}

function walkAST(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  detectReactComponent(node, evidenceId, file, signals)
  ts.forEachChild(node, (child) => walkAST(child, evidenceId, file, signals))
}

function detectReactComponent(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  if (ts.isFunctionDeclaration(node)) {
    const name = node.name?.text
    if (name && isComponentName(name)) {
      signals.push(createSignal({
        evidenceId,
        kind: "component",
        language: "typescript",
        file,
        name,
        text: `function ${name}(...)`,
        tags: ["component", name, FRAMEWORK],
        confidence: 0.95,
        lineStart: node.getStart(),
        lineEnd: node.end,
        framework: FRAMEWORK,
      }))
    }
  }

  if (ts.isClassDeclaration(node)) {
    const name = node.name?.text
    if (name && isComponentName(name)) {
      signals.push(createSignal({
        evidenceId,
        kind: "component",
        language: "typescript",
        file,
        name,
        text: `class ${name} extends React.Component(...)`,
        tags: ["component", name, FRAMEWORK],
        confidence: 0.95,
        lineStart: node.getStart(),
        lineEnd: node.end,
        framework: FRAMEWORK,
      }))
    }
  }

  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (!ts.isVariableDeclaration(decl)) continue

      const varName = decl.name
      if (!ts.isIdentifier(varName)) continue

      const name = varName.text
      if (!isComponentName(name)) continue

      if (decl.initializer) {
        if (ts.isArrowFunction(decl.initializer)) {
          signals.push(createSignal({
            evidenceId,
            kind: "component",
            language: "typescript",
            file,
            name,
            text: `const ${name} = (...) => ...`,
            tags: ["component", name, FRAMEWORK, "arrow"],
            confidence: 0.95,
            lineStart: node.getStart(),
            lineEnd: node.end,
            framework: FRAMEWORK,
          }))
        } else if (ts.isFunctionExpression(decl.initializer)) {
          signals.push(createSignal({
            evidenceId,
            kind: "component",
            language: "typescript",
            file,
            name,
            text: `const ${name} = function(...) { ... }`,
            tags: ["component", name, FRAMEWORK, "function"],
            confidence: 0.95,
            lineStart: node.getStart(),
            lineEnd: node.end,
            framework: FRAMEWORK,
          }))
        }
      }
    }
  }

  if (ts.isExportAssignment(node)) {
    const expr = node.expression
    if (ts.isIdentifier(expr)) {
      const name = expr.text
      if (name && isComponentName(name)) {
        signals.push(createSignal({
          evidenceId,
          kind: "component",
          language: "typescript",
          file,
          name,
          text: `export default ${name}`,
          tags: ["component", name, FRAMEWORK, "default-export"],
          confidence: 0.95,
          lineStart: node.getStart(),
          lineEnd: node.end,
          framework: FRAMEWORK,
        }))
      }
    }
  }
}

function isComponentName(name: string): boolean {
  if (!name) return false

  if (name.charAt(0) !== name.charAt(0).toUpperCase()) return false

  if (name.startsWith("_") || name.startsWith("use") || name.startsWith("set")) return false

  const excludedNames = ["console", "JSON", "Math", "Date", "Array", "Object", "Promise"]
  if (excludedNames.includes(name)) return false

  return true
}

export function extractReactComponentsRegex(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []

  const patterns = [
    /(?:export\s+)?function\s+([A-Z][a-zA-Z0-9]*)\s*\(/g,
    /class\s+([A-Z][a-zA-Z0-9]*)\s+extends\s+React\.Component/g,
    /const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*(?:\([^)]*\)\s*=>|<)/g,
    /const\s+([A-Z][a-zA-Z0-9]*)\s*=\s*function/g,
    /export\s+default\s+([A-Z][a-zA-Z0-9]*)/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const name = match[1]
      if (name && isComponentName(name)) {
        signals.push(createSignal({
          evidenceId,
          kind: "component",
          language: "typescript",
          file,
          name,
          text: `Component ${name}`,
          tags: ["component", name, FRAMEWORK],
          confidence: 0.85,
          lineStart: getLineNumber(content, match.index),
          framework: FRAMEWORK,
        }))
      }
    }
  }

  return signals
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length
}

export function isReactProject(content: string, file: string): boolean {
  return /\bReact\b/.test(content) ||
    /\bjsx\b/.test(content) ||
    /\btsx\b/.test(content) ||
    /from\s+["']react["']/.test(content) ||
    /from\s+["']@mui/.test(content) ||
    /from\s+["']tailwindcss/.test(content) ||
    /from\s+["']next/.test(content)
}

export function hasReactComponents(content: string): boolean {
  return /function\s+[A-Z][a-zA-Z0-9]*/.test(content) ||
    /class\s+[A-Z][a-zA-Z0-9]*\s+extends\s+React\.Component/.test(content) ||
    /const\s+[A-Z][a-zA-Z0-9]*\s*=\s*(?:\([^)]*\)\s*=>|<)/.test(content)
}