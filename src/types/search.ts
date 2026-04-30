import type { Signal } from "./signal.js"

export interface SearchOptions {
  query: string
  limit?: number
  kind?: string
  framework?: string
  file?: string
}

export interface SearchResult {
  score: number
  kind: string
  framework?: string
  language?: string
  file?: string
  name?: string
  text: string
  lineStart?: number
  lineEnd?: number
  confidence: number
  evidenceId: string
}

export interface SearchResponse {
  query: string
  count: number
  results: SearchResult[]
}

export interface RetrievalStats {
  indexedSignals: number
  indexSizeBytes: number
  lastIndexedAt?: number
}