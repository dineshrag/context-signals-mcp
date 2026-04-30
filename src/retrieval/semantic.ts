import type { Signal } from "../types/signal.js"

export interface SemanticConfig {
  enabled: boolean
  model?: string
  dimension?: number
}

export const DEFAULT_SEMANTIC_CONFIG: SemanticConfig = {
  enabled: false,
}

export interface SemanticVector {
  id: string
  vector: number[]
}

export interface SemanticSearchResult {
  id: string
  score: number
  signal: Signal
}

export class SemanticSearch {
  private config: SemanticConfig
  private vectors: Map<string, SemanticVector> = new Map()

  constructor(config: SemanticConfig = DEFAULT_SEMANTIC_CONFIG) {
    this.config = config
  }

  async index(signals: Signal[]): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    for (const signal of signals) {
      const vector = await this.computeEmbedding(signal)
      this.vectors.set(signal.id, { id: signal.id, vector })
    }
  }

  async add(signal: Signal): Promise<void> {
    if (!this.config.enabled) {
      return
    }

    const vector = await this.computeEmbedding(signal)
    this.vectors.set(signal.id, { id: signal.id, vector })
  }

  async search(query: string, signals: Signal[], limit: number = 10): Promise<SemanticSearchResult[]> {
    if (!this.config.enabled) {
      return []
    }

    const queryVector = await this.computeQueryEmbedding(query)

    const results: SemanticSearchResult[] = []

    for (const signal of signals) {
      const stored = this.vectors.get(signal.id)
      if (!stored) continue

      const score = this.cosineSimilarity(queryVector, stored.vector)

      results.push({
        id: signal.id,
        score,
        signal,
      })
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  async remove(id: string): Promise<void> {
    this.vectors.delete(id)
  }

  clear(): void {
    this.vectors.clear()
  }

  isEnabled(): boolean {
    return this.config.enabled
  }

  getConfig(): SemanticConfig {
    return { ...this.config }
  }

  private async computeEmbedding(signal: Signal): Promise<number[]> {
    const text = `${signal.name ?? ""} ${signal.text} ${signal.tags.join(" ")}`.trim()

    const hash = this.simpleHash(text)
    const dimension = this.config.dimension ?? 128
    const vector: number[] = []

    for (let i = 0; i < dimension; i++) {
      const seed = hash + i
      vector.push(this.seededRandom(seed))
    }

    this.normalize(vector)
    return vector
  }

  private async computeQueryEmbedding(query: string): Promise<number[]> {
    const hash = this.simpleHash(query.toLowerCase())
    const dimension = this.config.dimension ?? 128
    const vector: number[] = []

    for (let i = 0; i < dimension; i++) {
      const seed = hash + i
      vector.push(this.seededRandom(seed))
    }

    this.normalize(vector)
    return vector
  }

  private simpleHash(text: string): number {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash)
  }

  private seededRandom(seed: number): number {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  private normalize(vector: number[]): void {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0))
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude
      }
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let magnitudeA = 0
    let magnitudeB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      magnitudeA += a[i] * a[i]
      magnitudeB += b[i] * b[i]
    }

    const denom = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB)
    if (denom === 0) return 0

    return dotProduct / denom
  }
}

export function createSemanticSearch(config?: Partial<SemanticConfig>): SemanticSearch {
  return new SemanticSearch({ ...DEFAULT_SEMANTIC_CONFIG, ...config })
}

export function isSemanticEnabled(): boolean {
  return false
}