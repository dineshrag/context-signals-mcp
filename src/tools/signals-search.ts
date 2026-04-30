import type { Signal } from "../types/signal.js"

export interface SearchInput {
  query: string
  limit?: number
  kind?: string
  file?: string
  framework?: string
}

export interface SearchResult {
  id: string
  score: number
  kind: string
  language?: string
  file?: string
  name?: string
  text: string
  lineStart?: number
  lineEnd?: number
  confidence: number
  tags: string[]
  framework?: string
  route?: { method?: string; path?: string; handler?: string }
}

export interface SearchOutput {
  query: string
  count: number
  results: SearchResult[]
}

export async function handleSearch(
  input: SearchInput,
  context: {
    signalStore: any
    searchSignals: (signals: Signal[], options: any) => any[]
  }
): Promise<SearchOutput> {
  const { signalStore, searchSignals } = context

  const signals = await signalStore.load()
  const results = searchSignals(signals, {
    query: input.query,
    limit: input.limit ?? 8,
    kind: input.kind,
    file: input.file,
    framework: input.framework,
  })

  return {
    query: input.query,
    count: results.length,
    results,
  }
}