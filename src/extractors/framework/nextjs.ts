import ts from "typescript"
import path from "path"
import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

const FRAMEWORK = "nextjs" as const

export interface NextJsRouteInfo {
  method?: string
  path: string
  file: string
  isAppRouter: boolean
}

export function extractNextJsRoutes(content: string, file: string, evidenceId: string): Signal[] {
  const signals: Signal[] = []

  const fileName = path.basename(file)
  const dirName = path.dirname(file)

  const isAppRouter = dirName.includes("app") && (fileName === "route.ts" || fileName === "route.js")
  const isPagesRouter = dirName.includes("pages") && fileName.startsWith("api/")

  if (isAppRouter) {
    const routes = extractAppRouterRoutes(content, file, evidenceId, dirName)
    signals.push(...routes)
  } else if (isPagesRouter) {
    const routes = extractPagesRouterRoutes(content, file, evidenceId, dirName)
    signals.push(...routes)
  }

  return signals
}

function extractAppRouterRoutes(content: string, file: string, evidenceId: string, dirName: string): Signal[] {
  const signals: Signal[] = []

  try {
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

    const apiPath = extractApiPath(dirName)

    let detectedMethod = "GET"

    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement)) {
        const name = statement.name?.text
        if (name && isHttpMethod(name)) {
          detectedMethod = name.toUpperCase()

          signals.push(createSignal({
            evidenceId,
            kind: "route",
            language: "typescript",
            file,
            name: `${detectedMethod} ${apiPath}`,
            text: `${detectedMethod} ${apiPath}`,
            tags: ["route", detectedMethod, apiPath, FRAMEWORK, "app-router"],
            confidence: 0.95,
            lineStart: statement.getStart(),
            lineEnd: statement.end,
            framework: FRAMEWORK,
            route: {
              method: detectedMethod,
              path: apiPath,
            },
          }))
        }
      }

      if (ts.isExportAssignment(statement)) {
        const expr = statement.expression
        if (ts.isObjectLiteralExpression(expr)) {
          for (const prop of expr.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const methodName = prop.name.text
              if (isHttpMethod(methodName)) {
                signals.push(createSignal({
                  evidenceId,
                  kind: "route",
                  language: "typescript",
                  file,
                  name: `${methodName.toUpperCase()} ${apiPath}`,
                  text: `${methodName.toUpperCase()} ${apiPath}`,
                  tags: ["route", methodName.toUpperCase(), apiPath, FRAMEWORK, "app-router"],
                  confidence: 0.95,
                  lineStart: statement.getStart(),
                  lineEnd: statement.end,
                  framework: FRAMEWORK,
                  route: {
                    method: methodName.toUpperCase(),
                    path: apiPath,
                  },
                }))
              }
            }
          }
        }
      }
    }
  } catch {
    return extractAppRouterRoutesRegex(content, file, evidenceId, dirName)
  }

  return signals
}

function extractPagesRouterRoutes(content: string, file: string, evidenceId: string, dirName: string): Signal[] {
  const signals: Signal[] = []

  const apiPath = extractPagesApiPath(dirName, file)

  try {
    const sourceFile = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

    for (const statement of sourceFile.statements) {
      if (ts.isFunctionDeclaration(statement)) {
        const name = statement.name?.text
        if (name && isHttpMethod(name)) {
          signals.push(createSignal({
            evidenceId,
            kind: "route",
            language: "typescript",
            file,
            name: `${name.toUpperCase()} ${apiPath}`,
            text: `${name.toUpperCase()} ${apiPath}`,
            tags: ["route", name.toUpperCase(), apiPath, FRAMEWORK, "pages-router"],
            confidence: 0.95,
            lineStart: statement.getStart(),
            lineEnd: statement.end,
            framework: FRAMEWORK,
            route: {
              method: name.toUpperCase(),
              path: apiPath,
            },
          }))
        }
      }
    }
  } catch {
    return extractPagesRouterRoutesRegex(content, file, evidenceId, dirName, file)
  }

  return signals
}

function extractApiPath(dirName: string): string {
  const appIndex = dirName.indexOf("app")
  if (appIndex === -1) return "/api"

  const afterApp = dirName.substring(appIndex + 4)
  const parts = afterApp.split(path.sep).filter(p => p && p !== "api")

  let apiPath = "/api"
  for (const part of parts) {
    if (part === "[...slug]" || part === "[...catchAll]") {
      apiPath += "/*"
      break
    } else if (part.startsWith("[") && part.endsWith("]")) {
      apiPath += `/${part.slice(1, -1)}`
    } else if (part !== "route" && part !== "page") {
      apiPath += `/${part}`
    }
  }

  return apiPath || "/api"
}

function extractPagesApiPath(dirName: string, file: string): string {
  const pagesIndex = dirName.indexOf("pages")
  if (pagesIndex === -1) return "/api"

  const afterPages = dirName.substring(pagesIndex + 7)
  const fileName = path.basename(file, path.extname(file))

  let apiPath = afterPages.replace(/\\/g, "/")

  if (fileName !== "index") {
    if (apiPath.endsWith("/index")) {
      apiPath = apiPath.substring(0, apiPath.length - 6)
    }
    apiPath += `/${fileName}`
  }

  apiPath = apiPath.replace(/\/index$/, "")
  apiPath = apiPath.replace(/\[([^\]]+)\]/g, ":$1")

  return apiPath || "/api"
}

function isHttpMethod(name: string): boolean {
  const methods = ["get", "post", "put", "patch", "delete", "head", "options"]
  return methods.includes(name.toLowerCase())
}

function extractAppRouterRoutesRegex(content: string, file: string, evidenceId: string, dirName: string): Signal[] {
  const signals: Signal[] = []
  const apiPath = extractApiPath(dirName)

  const exportPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gi
  let match

  while ((match = exportPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase()
    signals.push(createSignal({
      evidenceId,
      kind: "route",
      language: "typescript",
      file,
      name: `${method} ${apiPath}`,
      text: `${method} ${apiPath}`,
      tags: ["route", method, apiPath, FRAMEWORK, "app-router"],
      confidence: 0.85,
      lineStart: getLineNumber(content, match.index),
      framework: FRAMEWORK,
      route: {
        method,
        path: apiPath,
      },
    }))
  }

  return signals
}

function extractPagesRouterRoutesRegex(content: string, file: string, evidenceId: string, dirName: string, fullFile: string): Signal[] {
  const signals: Signal[] = []
  const apiPath = extractPagesApiPath(dirName, fullFile)

  const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/gi
  let match

  while ((match = functionPattern.exec(content)) !== null) {
    const method = match[1].toUpperCase()
    signals.push(createSignal({
      evidenceId,
      kind: "route",
      language: "typescript",
      file,
      name: `${method} ${apiPath}`,
      text: `${method} ${apiPath}`,
      tags: ["route", method, apiPath, FRAMEWORK, "pages-router"],
      confidence: 0.85,
      lineStart: getLineNumber(content, match.index),
      framework: FRAMEWORK,
      route: {
        method,
        path: apiPath,
      },
    }))
  }

  return signals
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length
}

export function isNextJsProject(content: string, file: string): boolean {
  return /\bnext\b/.test(content) ||
    /\buse client\b/.test(content) ||
    /\buse server\b/.test(content) ||
    file.includes("next.config") ||
    /from\s+["']next/.test(content)
}

export function isNextJsApiRoute(file: string): boolean {
  const fileName = path.basename(file)
  const dirName = path.dirname(file)
  return (dirName.includes("app") && (fileName === "route.ts" || fileName === "route.js")) ||
    (dirName.includes("pages") && dirName.includes("api"))
}