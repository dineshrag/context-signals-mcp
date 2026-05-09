import { Bm25Index, createBm25Index, type IndexedDocument, type Bm25SearchResult } from "./bm25.js"
import { computeScore, type ScoringOptions } from "./scoring.js"
import { GraphScorer, computeFinalScore, type GraphScoringOptions } from "./graph-scorer.js"
import { extractQueryIntent, type QueryIntent } from "./query-intent.js"
import { computeLexicalBoost, type LexicalBoostOptions } from "./lexical-boost.js"
import type { Signal } from "../types/signal.js"
import type { CallEdge } from "../storage/sql-store.js"

export interface HybridSearchOptions {
  bm25Weight: number
  graphWeight: number
  metadataWeight: number
  localityWeight: number
  lexicalBoostWeight: number
  scoringOptions: Partial<ScoringOptions>
  graphScoringOptions: Partial<GraphScoringOptions>
  lexicalBoostOptions: Partial<LexicalBoostOptions>
  limit: number
  minScore: number
}

export const DEFAULT_HYBRID_OPTIONS: HybridSearchOptions = {
  bm25Weight: 0.4,
  graphWeight: 0.25,
  metadataWeight: 0.1,
  localityWeight: 0.05,
  lexicalBoostWeight: 0.6,
  scoringOptions: {},
  graphScoringOptions: {},
  lexicalBoostOptions: {},
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

export interface SearchResultExtended extends SearchResult {
  bm25Score: number
  graphScore: number
  metadataScore: number
  localityScore: number
  edgeConfidences: number[]
  confidenceMultiplier: number
}

export class HybridSearch {
  private bm25Index: Bm25Index
  private graphScorer: GraphScorer
  private options: HybridSearchOptions
  private recentFiles: string[] = []

  constructor(options: Partial<HybridSearchOptions> = {}) {
    this.options = { ...DEFAULT_HYBRID_OPTIONS, ...options }
    this.bm25Index = createBm25Index()
    this.graphScorer = new GraphScorer(this.options.graphScoringOptions)
  }

  index(signals: Signal[]): void {
    const documents = signals.map(signalToDocument)
    this.bm25Index.index(documents)
  }

  indexCallEdges(edges: CallEdge[]): void {
    this.graphScorer.indexCallEdges(edges)
  }

  add(signal: Signal): void {
    this.bm25Index.add(signalToDocument(signal))
  }

  remove(id: string): void {
    this.bm25Index.remove(id)
  }

  addRecentFile(file: string): void {
    this.recentFiles = this.recentFiles.filter(f => f !== file)
    this.recentFiles.unshift(file)
    if (this.recentFiles.length > 10) {
      this.recentFiles.pop()
    }
  }

  clearRecentFiles(): void {
    this.recentFiles = []
  }

  search(query: string, options?: { limit?: number; kind?: string; framework?: string; file?: string }): SearchResult[] {
    const limit = options?.limit ?? this.options.limit

    const queryIntent = extractQueryIntent(query)

    const bm25Results = this.bm25Index.query(queryIntent.originalQuery, { limit: limit * 3 })

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

    const signals = documents.map(documentToSignal)
    const candidateIds = documents.map(d => d.id)

    const withScores = documents.map((doc: IndexedDocument) => {
      const bm25Result = bm25Results.find((r: Bm25SearchResult) => r.id === doc.id)
      const bm25Score = bm25Result?.score ?? 0

      const signal = documentToSignal(doc)

      const graphResult = this.graphScorer.computeGraphScore(queryIntent.originalQuery, signal)
      const graphScore = graphResult.score

      const metadataScore = computeScore(signal, queryIntent.originalQuery, this.options.scoringOptions)

      const localityScore = this.graphScorer.computeLocalityScore(signal, this.recentFiles)

      const lexicalScore = computeLexicalBoost(queryIntent.originalQuery, signal, this.options.lexicalBoostOptions)

      const chainResult = this.graphScorer.computeChainScore(signal.id, signals, candidateIds, 2)
      const chainBoost = chainResult.score * 0.3

      const finalScore = computeFinalScore(
        bm25Score,
        graphScore + chainBoost,
        metadataScore,
        localityScore,
        lexicalScore,
        {
          bm25Weight: this.options.bm25Weight,
          graphWeight: this.options.graphWeight,
          metadataWeight: this.options.metadataWeight,
          localityWeight: this.options.localityWeight,
          lexicalWeight: this.options.lexicalBoostWeight,
        },
        signal.confidence,
        graphResult.edgeConfidences
      )

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
        score: Number(finalScore.toFixed(2)),
        bm25Score: Number(bm25Score.toFixed(2)),
        graphScore: Number(graphScore.toFixed(2)),
        metadataScore: Number(metadataScore.toFixed(2)),
        localityScore: Number(localityScore.toFixed(2)),
        lexicalScore: Number(lexicalScore.toFixed(2)),
        edgeConfidences: graphResult.edgeConfidences,
        confidenceMultiplier: graphResult.confidenceMultiplier,
      } as SearchResultExtended
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

  searchWithBreakdown(query: string, options?: { limit?: number; kind?: string; framework?: string; file?: string }): SearchResultExtended[] {
    const results = this.search(query, options) as SearchResultExtended[]
    return results
  }

  clear(): void {
    this.bm25Index.clear()
    this.graphScorer.clear()
    this.recentFiles = []
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