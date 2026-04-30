import ts from "typescript"
import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

const FRAMEWORK = "fastify" as const

export function extractFastifyRoutes(content: string, file: string, evidenceId: string): Signal[] {
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
    return extractFastifyRoutesRegex(content, file, evidenceId)
  }

  return signals
}

function walkAST(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  detectFastifyRoute(node, evidenceId, file, signals)
  ts.forEachChild(node, (child) => walkAST(child, evidenceId, file, signals))
}

function detectFastifyRoute(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  if (!ts.isCallExpression(node)) return

  const expr = node.expression
  if (!ts.isPropertyAccessExpression(expr)) return

  const methodName = expr.name.text
  if (!isFastifyMethod(methodName)) return

  const args = node.arguments
  if (args.length < 2) return

  const pathArg = args[0]
  const handlerArg = args[1]

  let path = ""
  if (ts.isStringLiteral(pathArg)) {
    path = pathArg.text
  } else if (ts.isObjectLiteralExpression(pathArg)) {
    path = extractPathFromObject(pathArg)
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

  detectFastifyRouteObject(node, evidenceId, file, signals)
}

function detectFastifyRouteObject(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  if (!ts.isCallExpression(node)) return

  const expr = node.expression
  if (!ts.isPropertyAccessExpression(expr)) return

  if (expr.name.text !== "route") return

  const args = node.arguments
  if (args.length < 1) return

  const routeArg = args[0]
  if (!ts.isObjectLiteralExpression(routeArg)) return

  let method = ""
  let url = ""
  let handler = ""

  for (const prop of routeArg.properties) {
    if (!ts.isPropertyAssignment(prop)) continue

    const name = prop.name
    if (!ts.isIdentifier(name)) continue

    const propName = name.text

    if (propName === "method" && ts.isStringLiteral(prop.initializer)) {
      method = prop.initializer.text
    } else if (propName === "url" && ts.isStringLiteral(prop.initializer)) {
      url = prop.initializer.text
    } else if (propName === "path" && ts.isStringLiteral(prop.initializer)) {
      url = prop.initializer.text
    } else if (propName === "handler") {
      if (ts.isIdentifier(prop.initializer)) {
        handler = prop.initializer.text
      }
    }
  }

  if (method && url) {
    signals.push(createSignal({
      evidenceId,
      kind: "route",
      language: "typescript",
      file,
      name: `${method.toUpperCase()} ${url}`,
      text: `${method.toUpperCase()} ${url}`,
      tags: ["route", method.toUpperCase(), url, FRAMEWORK],
      confidence: 0.95,
      lineStart: node.getStart(),
      lineEnd: node.end,
      framework: FRAMEWORK,
      route: {
        method: method.toUpperCase(),
        path: url,
        handler,
      },
    }))
  }
}

function extractPathFromObject(obj: ts.ObjectLiteralExpression): string {
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue
    const name = prop.name
    if (!ts.isIdentifier(name)) continue
    if (name.text === "url" || name.text === "path") {
      if (ts.isStringLiteral(prop.initializer)) {
        return prop.initializer.text
      }
    }
  }
  return ""
}

function isFastifyMethod(name: string): boolean {
  const methods = ["get", "post", "put", "patch", "delete", "options", "head", "route"]
  return methods.includes(name.toLowerCase())
}

export function extractFastifyRoutesRegex(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []

  const shorthandPattern = /fastify\.(get|post|put|patch|delete|options|head)\s*\(\s*["']([^"']+)["']\s*,/gm
  const routePattern = /fastify\.route\s*\(\s*\{[^}]*(?:method|url|url|path)[^}]*\}\s*,/gm

  let match
  while ((match = shorthandPattern.exec(content)) !== null) {
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

  return signals
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length
}

export function isFastifyApp(content: string): boolean {
  return /require\s*\(\s*["']fastify["']\s*\)/.test(content) ||
    /from\s+["']fastify["']/.test(content) ||
    /fastify\s*\(\s*\)/.test(content) ||
    /const\s+\w+\s*=\s*require\s*\(\s*["']fastify["']/.test(content)
}

export function hasFastifyRoutes(content: string): boolean {
  return /fastify\.(get|post|put|patch|delete|options|head|route)\s*\(/.test(content)
}