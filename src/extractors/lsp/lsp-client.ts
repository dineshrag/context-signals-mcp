import { createSignal } from "../../types/signal.js"
import type { Evidence } from "../../types/evidence.js"
import type { Signal } from "../../types/signal.js"

export interface LspConfig {
  command: string
  args?: string[]
  rootUri?: string
}

export interface LspSymbol {
  name: string
  kind: number
  location: {
    uri: string
    range: {
      start: { line: number; character: number }
      end: { line: number; character: number }
    }
  }
}

export interface LspEnrichment {
  symbols: LspSymbol[]
  diagnostics: Array<{ message: string; severity: number }>
  errors: string[]
}

const LSP_KIND_MAP: Record<number, string> = {
  1: "file",
  2: "module",
  3: "namespace",
  4: "package",
  5: "class",
  6: "method",
  7: "property",
  8: "field",
  9: "constructor",
  10: "enum",
  11: "interface",
  12: "function",
  13: "variable",
  14: "constant",
}

export async function tryLspEnrichment(
  content: string,
  file: string,
  evidenceId: string,
  config?: LspConfig
): Promise<LspEnrichment | null> {
  if (!config) {
    return null
  }

  try {
    return await fetchLspSymbols(file, config)
  } catch {
    return null
  }
}

async function fetchLspSymbols(file: string, config: LspConfig): Promise<LspEnrichment> {
  return {
    symbols: [],
    diagnostics: [],
    errors: ["LSP not configured or unavailable"],
  }
}

export function extractLspSignals(
  evidenceId: string,
  file: string,
  enrichment: LspEnrichment
): Signal[] {
  const signals: Signal[] = []

  for (const symbol of enrichment.symbols) {
    const kind = LSP_KIND_MAP[symbol.kind] ?? "symbol"
    const lineStart = symbol.location.range.start.line + 1

    signals.push(createSignal({
      evidenceId,
      kind: kind as any,
      language: "typescript",
      file,
      name: symbol.name,
      text: `${kind} ${symbol.name}`,
      tags: [kind, "lsp", symbol.name],
      confidence: 0.95,
      lineStart,
      lineEnd: symbol.location.range.end.line + 1,
    }))
  }

  return signals
}

export function isLspAvailable(): boolean {
  return false
}

export function getLspStatus(): { enabled: boolean; available: boolean; reason?: string } {
  return {
    enabled: false,
    available: false,
    reason: "LSP enrichment is optional and not configured",
  }
}

export function createLspConfig(worktree: string): LspConfig | undefined {
  const tsserver = findTypeScriptServer()
  if (!tsserver) return undefined

  return {
    command: tsserver,
    args: ["--stdio"],
    rootUri: `file://${worktree}`,
  }
}

function findTypeScriptServer(): string | null {
  return null
}

export function lspKindToSignalKind(kind: number): string {
  return LSP_KIND_MAP[kind] ?? "symbol"
}

export function parseLspResponse(output: string): LspEnrichment | null {
  try {
    const parsed = JSON.parse(output)
    return parsed as LspEnrichment
  } catch {
    return null
  }
}