import { createHybridSearch, type SearchResult as HybridSearchResult } from "./retrieval/index.js"

export interface SignalLike {
  id: string
  evidenceId: string
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

export type SearchOptions = {
  query: string
  limit?: number
  kind?: string
  file?: string
  framework?: string
}

export type SearchResult = {
  score: number
  kind: string
  language?: string
  file?: string
  name?: string
  text: string
  lineStart?: number
  lineEnd?: number
  confidence: number
  evidenceId: string
  framework?: string
  route?: { method?: string; path?: string; handler?: string }
}

const hybridSearch = createHybridSearch({
  bm25Weight: 0.7,
  scoringWeight: 0.3,
  limit: 10,
  minScore: 0.05,
})

function shortenPath(file?: string): string | undefined {
  if (!file) return undefined
  return file.replace(/\\/g, "/")
}

export function searchSignals(signals: SignalLike[], options: SearchOptions): SearchResult[] {
  hybridSearch.clear()

  const signalsWithId = signals.filter(s => s.id)
  hybridSearch.index(signalsWithId as any)

  const results = hybridSearch.search(options.query, {
    limit: options.limit ?? 10,
    kind: options.kind,
    framework: options.framework,
    file: options.file,
  })

  const dedupedResults: SearchResult[] = []
  const seen = new Set<string>()

  for (const result of results) {
    const key = [
      result.kind,
      result.file ?? "",
      result.name ?? "",
      result.lineStart ?? "",
      result.text,
    ].join("|")

    if (seen.has(key)) continue
    seen.add(key)

    dedupedResults.push({
      score: result.score,
      kind: result.kind,
      language: result.language,
      file: shortenPath(result.file),
      name: result.name,
      text: result.text,
      lineStart: result.lineStart,
      lineEnd: result.lineEnd,
      confidence: result.confidence,
      evidenceId: result.id,
      framework: result.framework,
      route: result.route,
    })
  }

  return dedupedResults.slice(0, options.limit ?? 8)
}

export function getSignalKinds(): string[] {
  return [
    "file",
    "import",
    "export",
    "function",
    "class",
    "interface",
    "type",
    "component",
    "route",
    "middleware",
    "symbol",
    "diagnostic",
  ]
}

export function getSearchStats() {
  return hybridSearch.getStats()
}