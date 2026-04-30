import ts from "typescript"
import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

const FRAMEWORK = "express" as const

export interface ExpressRouteSignal {
  method: string
  path: string
  handler?: string
}

export function extractExpressRoutes(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []

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
    // Fall back to regex if AST fails
    return extractExpressRoutesRegex(content, file, evidenceId)
  }

  return signals
}

function walkAST(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  detectExpressRoute(node, evidenceId, file, signals)
  ts.forEachChild(node, (child) => walkAST(child, evidenceId, file, signals))
}

function detectExpressRoute(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  if (!ts.isCallExpression(node)) return

  const expr = node.expression
  if (!ts.isPropertyAccessExpression(expr)) return

  const methodName = expr.name.text
  if (!isExpressMethod(methodName)) return

  const args = node.arguments
  if (args.length < 2) return

  const pathArg = args[0]
  const handlerArg = args[1]

  let path = ""
  if (ts.isStringLiteral(pathArg)) {
    path = pathArg.text
  }

  let handler = ""
  if (ts.isIdentifier(handlerArg)) {
    handler = handlerArg.text
  } else if (ts.isPropertyAccessExpression(handlerArg)) {
    handler = handlerArg.name.text
  } else if (ts.isFunctionExpression(handlerArg)) {
    handler = "anonymous"
  }

  if (path) {
    const routeSignal = createSignal({
      evidenceId,
      kind: "route",
      language: "typescript",
      file,
      name: `${methodName.toUpperCase()} ${path}`,
      text: `${methodName.toUpperCase()} ${path}`,
      tags: ["route", methodName.toUpperCase(), path, FRAMEWORK],
      confidence: 0.95,
      lineStart: node.getStart(),
      lineEnd: node.end,
      framework: FRAMEWORK,
      route: {
        method: methodName.toUpperCase(),
        path,
        handler,
      },
    })

    signals.push(routeSignal)
  }
}

function isExpressMethod(name: string): boolean {
  const methods = ["get", "post", "put", "patch", "delete", "options", "head", "router"]
  return methods.includes(name.toLowerCase())
}

export function extractExpressRoutesRegex(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []
  const patterns = [
    /(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']\s*,/gm,
    /@([A-Za-z]+)\s*\(\s*["']([^"']+)["']\s*,/gm,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const [, method, path] = match
      if (path && method) {
        signals.push(createSignal({
          evidenceId,
          kind: "route",
          language: "typescript",
          file,
          name: `${method.toUpperCase()} ${path}`,
          text: `${method.toUpperCase()} ${path}`,
          tags: ["route", method.toUpperCase(), path, FRAMEWORK],
          confidence: 0.85,
          lineStart: getLineNumber(content, match.index),
          framework: FRAMEWORK,
          route: {
            method: method.toUpperCase(),
            path,
          },
        }))
      }
    }
  }

  return signals
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length
}

export function isExpressApp(content: string): boolean {
  return /require\s*\(\s*["']express["']\s*\)/.test(content) ||
    /from\s+["']express["']/.test(content) ||
    /app\s*=\s*express\(\)/.test(content) ||
    /express\(\)/.test(content)
}

export function hasExpressRoutes(content: string): boolean {
  return /\.(get|post|put|patch|delete|options|head)\s*\(/.test(content)
}