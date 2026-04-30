import { extractTypeScript, detectReactComponent } from "./ast/typescript.js"
import { extractJavaScript, detectReactComponent as detectReactComponentJS } from "./ast/javascript.js"
import { extractExpressRoutes, isExpressApp, hasExpressRoutes } from "./framework/express.js"
import { extractFastifyRoutes, isFastifyApp, hasFastifyRoutes } from "./framework/fastify.js"
import { extractNextJsRoutes, isNextJsProject, isNextJsApiRoute } from "./framework/nextjs.js"
import { extractReactComponents, isReactProject, hasReactComponents } from "./framework/react.js"
import { createSignal } from "../types/signal.js"
import type { Evidence } from "../types/evidence.js"

export type Signal = ReturnType<typeof createSignal>

export interface ExtractOptions {
  forceLanguage?: "typescript" | "javascript"
  includeFrameworkRoutes?: boolean
  includeComponents?: boolean
}

export interface ExtractResult {
  signals: Signal[]
  errors: string[]
  language: "typescript" | "javascript"
  isReactComponent: boolean
  detectedFrameworks: string[]
}

export function extract(content: string, file: string, evidence: Evidence, options: ExtractOptions = {}): ExtractResult {
  const { includeFrameworkRoutes = true, includeComponents = true } = options

  const language = options?.forceLanguage ?? detectLanguage(file)
  const errors: string[] = []
  let signals: Signal[] = []
  let isReactComponent = false
  const detectedFrameworks: string[] = []

  if (language === "typescript") {
    const result = extractTypeScript(content, file, evidence.id)
    signals = result.signals
    errors.push(...result.errors)
    isReactComponent = detectReactComponent(content, file)
  } else {
    const result = extractJavaScript(content, file, evidence.id)
    signals = result.signals
    errors.push(...result.errors)
    isReactComponent = detectReactComponentJS(content, file)
  }

  if (includeFrameworkRoutes) {
    if (isExpressApp(content) || hasExpressRoutes(content)) {
      detectedFrameworks.push("express")
      const routes = extractExpressRoutes(content, file, evidence.id)
      signals.push(...routes)
    }

    if (isFastifyApp(content) || hasFastifyRoutes(content)) {
      detectedFrameworks.push("fastify")
      const routes = extractFastifyRoutes(content, file, evidence.id)
      signals.push(...routes)
    }

    if (isNextJsProject(content, file) || isNextJsApiRoute(file)) {
      detectedFrameworks.push("nextjs")
      const routes = extractNextJsRoutes(content, file, evidence.id)
      signals.push(...routes)
    }
  }

  if (includeComponents && (isReactProject(content, file) || hasReactComponents(content))) {
    detectedFrameworks.push("react")
    const components = extractReactComponents(content, file, evidence.id)
    signals.push(...components)
  }

  const deduplicated = deduplicateSignals(signals)

  return {
    signals: deduplicated,
    errors,
    language,
    isReactComponent,
    detectedFrameworks,
  }
}

export function extractWithFramework(
  content: string,
  file: string,
  evidence: Evidence,
  framework?: "express" | "fastify" | "nextjs" | "react"
): ExtractResult {
  const result = extract(content, file, evidence, { includeFrameworkRoutes: true, includeComponents: true })

  if (framework) {
    result.signals = result.signals.map(s => ({
      ...s,
      framework: framework,
    }))
  }

  return result
}

export function extractRoutes(
  content: string,
  file: string,
  evidence: Evidence,
  framework: "express" | "fastify" | "nextjs"
): Signal[] {
  switch (framework) {
    case "express":
      return extractExpressRoutes(content, file, evidence.id)
    case "fastify":
      return extractFastifyRoutes(content, file, evidence.id)
    case "nextjs":
      return extractNextJsRoutes(content, file, evidence.id)
    default:
      return []
  }
}

export function extractComponents(
  content: string,
  file: string,
  evidence: Evidence
): Signal[] {
  return extractReactComponents(content, file, evidence.id)
}

function deduplicateSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>()
  const result: Signal[] = []

  for (const signal of signals) {
    const key = signalKey(signal)
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

function detectLanguage(file: string): "typescript" | "javascript" {
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase()
  if (ext === ".ts" || ext === ".tsx") return "typescript"
  if (ext === ".js" || ext === ".jsx" || ext === ".mjs" || ext === ".cjs") return "javascript"
  return "typescript"
}

export { detectReactComponent } from "./ast/typescript.js"
export { detectReactComponent as detectReactComponentJS } from "./ast/javascript.js"
export { isExpressApp, hasExpressRoutes } from "./framework/express.js"
export { isFastifyApp, hasFastifyRoutes } from "./framework/fastify.js"
export { isNextJsProject, isNextJsApiRoute } from "./framework/nextjs.js"
export { isReactProject, hasReactComponents } from "./framework/react.js"
export { detectLanguage }