import MiniSearch from "minisearch"
import type { Signal } from "./extractor.js"

export type SearchOptions = {
  query: string
  limit?: number
  kind?: string
  file?: string
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
}

function buildSearch(signals: Signal[]) {
  const search = new MiniSearch<Signal>({
    fields: ["text", "file", "name", "kind", "language", "tags"],
    storeFields: [
      "id",
      "evidenceId",
      "kind",
      "language",
      "file",
      "name",
      "text",
      "lineStart",
      "lineEnd",
      "confidence",
      "tags",
    ],
    searchOptions: {
      boost: {
        name: 4,
        tags: 3,
        file: 2,
        kind: 2,
        text: 1,
      },
      prefix: true,
      fuzzy: 0.15,
    },
  })

  search.addAll(signals)
  return search
}

function shortenPath(file?: string): string | undefined {
  if (!file) return undefined
  return file.replace(/\\/g, "/")
}

export function searchSignals(signals: Signal[], options: SearchOptions): SearchResult[] {
  let filtered = signals

  if (options.kind) {
    filtered = filtered.filter((signal) => signal.kind === options.kind)
  }

  if (options.file) {
    const fileQuery = options.file.toLowerCase().replace(/\\/g, "/")
    filtered = filtered.filter((signal) =>
      signal.file?.toLowerCase().replace(/\\/g, "/").includes(fileQuery)
    )
  }

  const search = buildSearch(filtered)
  const dedupedResults: SearchResult[] = []
  const seen = new Set<string>()

  for (const result of search.search(options.query)) {
    const key = [
      result.kind ?? "",
      result.file ?? "",
      result.name ?? "",
      result.lineStart ?? "",
      result.text ?? "",
    ].join("|")

    if (seen.has(key)) continue
    seen.add(key)
    dedupedResults.push({
      score: Number(result.score?.toFixed?.(2) ?? result.score),
      kind: result.kind,
      language: result.language,
      file: shortenPath(result.file),
      name: result.name,
      text: result.text,
      lineStart: result.lineStart,
      lineEnd: result.lineEnd,
      confidence: result.confidence,
      evidenceId: result.evidenceId,
    })
  }

  return dedupedResults.slice(0, options.limit ?? 8)
}

export function getSignalKinds(): string[] {
  return [
    "file_read",
    "file_path",
    "import",
    "function",
    "class",
    "route",
    "command_output",
    "search_match",
    "error",
    "lsp_result",
  ]
}