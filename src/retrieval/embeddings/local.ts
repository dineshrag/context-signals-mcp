import { pipeline, env } from "@xenova/transformers"

env.allowLocalModels = true
env.useBrowserCache = false

export interface EmbeddingOptions {
  modelName?: string
  dimension?: number
  device?: "cpu" | "wasm"
}

export interface EmbeddingResult {
  embedding: number[]
  latencyMs: number
}

export interface RerankCandidate {
  id: string
  text: string
  score: number
}

export interface RerankResult {
  id: string
  originalScore: number
  embeddingScore: number
  finalScore: number
}

export interface EmbeddingsMetrics {
  modelSizeMB: number
  indexTimeMs: number
  queryLatencyMs: number
  memoryMB: number
  indexedCount: number
}

const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2"

let embedder: Awaited<ReturnType<typeof pipeline>> | null = null
let embedderLoading: Promise<Awaited<ReturnType<typeof pipeline>>> | null = null

let metrics: EmbeddingsMetrics = {
  modelSizeMB: 0,
  indexTimeMs: 0,
  queryLatencyMs: 0,
  memoryMB: 0,
  indexedCount: 0,
}

export function getMetrics(): EmbeddingsMetrics {
  return { ...metrics }
}

function estimateModelSizeMB(): number {
  return 90
}

async function getEmbedder(): Promise<Awaited<ReturnType<typeof pipeline>>> {
  if (embedder) return embedder

  if (embedderLoading) return embedderLoading

  console.log("[Embeddings] Loading model (first time only)...")
  const downloadStart = Date.now()

  embedderLoading = pipeline("feature-extraction", DEFAULT_MODEL, {
    quantized: true,
    progress_callback: (progress: { status: string; file?: string }) => {
      if (progress.status === "loading" && progress.file) {
        process.stdout.write(".")
      }
    },
  })

  const e = await embedderLoading
  embedder = e

  metrics.modelSizeMB = estimateModelSizeMB()
  console.log(`[Embeddings] Model ready (${metrics.modelSizeMB}MB, ${Date.now() - downloadStart}ms)`)

  return e
}

export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const start = Date.now()

  try {
    const embed = await getEmbedder()
    const result = await (embed as any)(text, { pooling: "mean" }) as unknown as { data: Record<string, number> }

    const embedding = Object.values(result.data).map(v => Number(v))

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] = embedding[i] / norm
      }
    }

    return {
      embedding,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    throw new Error(`Embedding generation failed: ${error}`)
  }
}

export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const result = await generateEmbedding(query)
  return result.embedding
}

export async function generateSignalEmbedding(signal: { id: string; name?: string; text: string }): Promise<{ id: string; embedding: number[] }> {
  const text = signal.name ? `${signal.name} ${signal.text}` : signal.text
  const result = await generateEmbedding(text)
  return { id: signal.id, embedding: result.embedding }
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  return isNaN(similarity) ? 0 : similarity
}

export async function rerankCandidates(
  query: string,
  candidates: RerankCandidate[],
  options: { topK?: number; blendWeight?: number } = {}
): Promise<RerankResult[]> {
  const { topK = 5, blendWeight = 0.3 } = options

  const queryEmbedding = await generateQueryEmbedding(query)

  const candidateEmbeddings = await Promise.all(
    candidates.map(async (c) => {
      const result = await generateEmbedding(c.text)
      return { id: c.id, embedding: result.embedding, originalScore: c.score }
    })
  )

  const scored = candidateEmbeddings.map((candidate) => {
    const embeddingScore = cosineSimilarity(queryEmbedding, candidate.embedding)

    const finalScore =
      (1 - blendWeight) * candidate.originalScore + blendWeight * embeddingScore

    return {
      id: candidate.id,
      originalScore: candidate.originalScore,
      embeddingScore: Number(embeddingScore.toFixed(4)),
      finalScore: Number(finalScore.toFixed(4)),
    }
  })

  scored.sort((a, b) => b.finalScore - a.finalScore)

  return scored.slice(0, topK)
}

export class LocalEmbeddingsReranker {
  private embeddings: Map<string, number[]> = new Map()
  private indexed = false

  async indexSignals(signals: { id: string; name?: string; text: string }[]): Promise<{ count: number; latencyMs: number }> {
    const start = Date.now()

    const embed = await getEmbedder()

    this.embeddings.clear()

    for (let i = 0; i < signals.length; i++) {
      const text = signals[i].name ? `${signals[i].name} ${signals[i].text}` : signals[i].text
      const result = await (embed as any)(text, { pooling: "mean" }) as unknown as { data: Record<string, number> }
      const embedding = Object.values(result.data).map(v => Number(v))
      const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0))
      if (norm > 0) {
        for (let j = 0; j < embedding.length; j++) {
          embedding[j] = embedding[j] / norm
        }
      }
      this.embeddings.set(signals[i].id, embedding)
    }

    this.indexed = true

    metrics.indexTimeMs = Date.now() - start
    metrics.indexedCount = signals.length

    return { count: signals.length, latencyMs: metrics.indexTimeMs }
  }

  async rerank(
    query: string,
    candidateIds: string[],
    originalScores: Map<string, number>,
    options: { topK?: number; blendWeight?: number } = {}
  ): Promise<RerankResult[]> {
    if (!this.indexed) {
      throw new Error("No signals indexed. Call indexSignals() first.")
    }

    const { topK = 5, blendWeight = 0.3 } = options

    const queryStart = Date.now()
    const queryResult = await generateEmbedding(query)
    const queryEmbedding = queryResult.embedding

    const candidates = candidateIds
      .filter((id) => this.embeddings.has(id))
      .map((id) => ({
        id,
        embedding: this.embeddings.get(id)!,
        originalScore: originalScores.get(id) ?? 0,
      }))

    const scored = candidates.map((candidate) => {
      const embeddingScore = cosineSimilarity(queryEmbedding, candidate.embedding)

      const finalScore =
        (1 - blendWeight) * candidate.originalScore + blendWeight * embeddingScore

      return {
        id: candidate.id,
        originalScore: candidate.originalScore,
        embeddingScore: Number(embeddingScore.toFixed(4)),
        finalScore: Number(finalScore.toFixed(4)),
      }
    })

    scored.sort((a, b) => b.finalScore - a.finalScore)

    metrics.queryLatencyMs = Date.now() - queryStart

    return scored.slice(0, topK)
  }

  clear(): void {
    this.embeddings.clear()
    this.indexed = false
    metrics.indexedCount = 0
  }

  getStats(): { indexedCount: number; dimension: number } {
    const firstEmbedding = this.embeddings.values().next().value
    return {
      indexedCount: this.embeddings.size,
      dimension: firstEmbedding?.length ?? 0,
    }
  }

  isIndexed(): boolean {
    return this.indexed
  }
}