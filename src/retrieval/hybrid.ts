import { Bm25Index, createBm25Index, type IndexedDocument, type Bm25SearchResult } from "./bm25.js"
import { computeScore, type ScoringOptions } from "./scoring.js"
import type { Signal } from "../types/signal.js"

export interface HybridSearchOptions {
  bm25Weight: number
  scoringWeight: number
  scoringOptions: Partial<ScoringOptions>
  limit: number
  minScore: number
}

export const DEFAULT_HYBRID_OPTIONS: HybridSearchOptions = {
  bm25Weight: 0.7,
  scoringWeight: 0.3,
  scoringOptions: {},
  limit: 10,
  minScore: 0.05,
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

export class HybridSearch {
  private bm25Index: Bm25Index
  private options: HybridSearchOptions

  constructor(options: Partial<HybridSearchOptions> = {}) {
    this.options = { ...DEFAULT_HYBRID_OPTIONS, ...options }
    this.bm25Index = createBm25Index()
  }

  index(signals: Signal[]): void {
    const documents = signals.map(signalToDocument)
    this.bm25Index.index(documents)
  }

  add(signal: Signal): void {
    this.bm25Index.add(signalToDocument(signal))
  }

  remove(id: string): void {
    this.bm25Index.remove(id)
  }

  search(query: string, options?: { limit?: number; kind?: string; framework?: string; file?: string }): SearchResult[] {
    const limit = options?.limit ?? this.options.limit

    const bm25Results = this.bm25Index.query(query, { limit: limit * 3 })

    if (bm25Results.length === 0) {
      return []
    }

    let documents: IndexedDocument[] = bm25Results.map((r: Bm25SearchResult) => r.document)

    if (options?.kind) {
      documents = documents.filter((d: IndexedDocument) => d.kind === options.kind)
    }

    if (options?.framework) {
      documents = documents.filter((d: IndexedDocument) => d.framework === options.framework)
    }

    if (options?.file) {
      const fileQuery = options.file.toLowerCase().replace(/\\/g, "/")
      documents = documents.filter((d: IndexedDocument) =>
        d.file?.toLowerCase().replace(/\\/g, "/").includes(fileQuery)
      )
    }

    const withScores = documents.map((doc: IndexedDocument) => {
      const bm25Result = bm25Results.find((r: Bm25SearchResult) => r.id === doc.id)
      const bm25Score = bm25Result?.score ?? 0
      const scoringResult = computeScore(documentToSignal(doc), query, this.options.scoringOptions)
      const combinedScore = (bm25Score * this.options.bm25Weight) + (scoringResult * this.options.scoringWeight)

      return {
        id: doc.id,
        evidenceId: doc.evidenceId,
        kind: doc.kind,
        language: doc.language,
        file: doc.file,
        name: doc.name,
        text: doc.text,
        lineStart: doc.lineStart,
        lineEnd: doc.lineEnd,
        confidence: doc.confidence,
        tags: doc.tags,
        framework: doc.framework,
        route: doc.route,
        score: Number(combinedScore.toFixed(2)),
      }
    })

    const maxScore = Math.max(...withScores.map(r => r.score), 0.001)
    const normalized = withScores.map(r => ({
      ...r,
      score: Number((r.score / maxScore).toFixed(2)),
    }))

    return normalized
      .filter((r) => r.score >= this.options.minScore)
      .slice(0, limit)
  }

  clear(): void {
    this.bm25Index.clear()
  }

  getStats(): { documentCount: number; indexedFields: string[] } {
    return this.bm25Index.getStats()
  }
}

function signalToDocument(signal: Signal): IndexedDocument {
  return {
    id: signal.id,
    evidenceId: signal.evidenceId,
    kind: signal.kind,
    language: signal.language,
    file: signal.file,
    name: signal.name,
    text: signal.text,
    lineStart: signal.lineStart,
    lineEnd: signal.lineEnd,
    confidence: signal.confidence,
    tags: signal.tags,
    framework: signal.framework,
    route: signal.route,
  }
}

function documentToSignal(doc: IndexedDocument): Signal {
  return {
    id: doc.id,
    evidenceId: doc.evidenceId,
    kind: doc.kind as Signal["kind"],
    language: doc.language as Signal["language"],
    file: doc.file ?? "",
    name: doc.name,
    text: doc.text,
    lineStart: doc.lineStart,
    lineEnd: doc.lineEnd,
    confidence: doc.confidence,
    tags: doc.tags,
    framework: doc.framework as Signal["framework"],
    route: doc.route,
    createdAt: Date.now(),
  }
}

export function createHybridSearch(options?: Partial<HybridSearchOptions>): HybridSearch {
  return new HybridSearch(options)
}