export type SignalKind =
  | "file"
  | "import"
  | "export"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "component"
  | "route"
  | "middleware"
  | "symbol"
  | "diagnostic"
  | "calls"
  | "imports"

export interface RouteInfo {
  method?: string
  path?: string
  handler?: string
}

export type Signal = {
  id: string
  evidenceId: string

  kind: SignalKind
  language: "typescript" | "javascript" | "python" | "unknown"

  file: string
  name?: string

  lineStart?: number
  lineEnd?: number

  framework?: "express" | "fastify" | "nextjs" | "react" | "unknown"

  route?: RouteInfo

  text: string
  tags: string[]

  confidence: number
  createdAt: number
  updatedAt?: number
}

import crypto from "crypto"

export function createDeterministicId(file: string, symbol: string, line: number): string {
  const input = `${file}::${symbol}::${line}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createSignal(data: Partial<Signal> & { evidenceId: string; text: string }): Signal {
  const symbol = data.name ?? data.text ?? ""
  const line = data.lineStart ?? 0
  const id = createDeterministicId(data.file ?? "", symbol, line)

  return {
    id,
    evidenceId: data.evidenceId,
    kind: data.kind ?? "function",
    language: data.language ?? "unknown",
    file: data.file ?? "",
    name: data.name,
    lineStart: data.lineStart,
    lineEnd: data.lineEnd,
    framework: data.framework,
    route: data.route,
    text: data.text,
    tags: data.tags ?? [],
    confidence: data.confidence ?? 0.8,
    createdAt: data.createdAt ?? Date.now(),
    updatedAt: data.updatedAt,
  }
}