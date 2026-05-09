import type { CallEdge } from "../storage/sql-store.js"
import { extractQueryIntent, type QueryIntent } from "./query-intent.js"
import type { Signal } from "../types/signal.js"

export interface GraphScoringOptions {
  callEdgeWeight: number
  importEdgeWeight: number
  resolvedSymbolBoost: number
  unresolvedSymbolPenalty: number
  staticEdgeBoost: number
  dynamicEdgePenalty: number
  inferredEdgePenalty: number
}

export const DEFAULT_GRAPH_SCORING_OPTIONS: GraphScoringOptions = {
  callEdgeWeight: 0.3,
  importEdgeWeight: 0.15,
  resolvedSymbolBoost: 1.5,
  unresolvedSymbolPenalty: 0.5,
  staticEdgeBoost: 1.0,
  dynamicEdgePenalty: 0.5,
  inferredEdgePenalty: 0.3,
}

export interface GraphScoreResult {
  score: number
  confidenceMultiplier: number
  matchingEdges: string[]
  edgeConfidences: number[]
}

export interface ChainAwareResult {
  signalId: string
  chainScore: number
  connectedSignals: string[]
  chainDepth: number
}

export class GraphScorer {
  private options: GraphScoringOptions
  private callEdges: Map<string, CallEdge[]> = new Map()
  private symbolToFile: Map<string, string> = new Map()
  private fileToSymbols: Map<string, Set<string>> = new Map()

  constructor(options: Partial<GraphScoringOptions> = {}) {
    this.options = { ...DEFAULT_GRAPH_SCORING_OPTIONS, ...options }
  }

  indexCallEdges(edges: CallEdge[]): void {
    for (const edge of edges) {
      const toKey = this.normalizeSymbol(edge.toRaw)
      if (!this.callEdges.has(toKey)) {
        this.callEdges.set(toKey, [])
      }
      this.callEdges.get(toKey)!.push(edge)

      if (edge.toResolved) {
        const resolvedKey = this.normalizeSymbol(edge.toResolved)
        this.callEdges.get(resolvedKey)?.push(edge)
      }

      if (edge.fromSymbol) {
        this.symbolToFile.set(`${edge.fromFile}::${edge.fromSymbol}`, edge.fromFile)

        if (!this.fileToSymbols.has(edge.fromFile)) {
          this.fileToSymbols.set(edge.fromFile, new Set())
        }
        this.fileToSymbols.get(edge.fromFile)!.add(edge.fromSymbol)
      }
    }
  }

  findConnectedSignals(signalId: string, allSignals: Signal[]): string[] {
    const connected: string[] = []
    const signal = allSignals.find(s => s.id === signalId)
    if (!signal) return connected

    const signalFile = signal.file
    const signalName = signal.name || ""

    for (const edge of this.callEdges.values()) {
      for (const e of edge) {
        if (e.fromFile === signalFile) {
          connected.push(`${e.fromFile}::${e.fromSymbol}`)
        }
        if (e.toRaw && this.normalizeSymbol(e.toRaw).includes(this.normalizeSymbol(signalName))) {
          connected.push(`${e.fromFile}::${e.fromSymbol}`)
        }
      }
    }

    return [...new Set(connected)]
  }

  computeChainScore(
    signalId: string,
    allSignals: Signal[],
    candidateIds: string[],
    chainDepth: number = 2
  ): { score: number; connectedCount: number; depth: number } {
    if (candidateIds.length === 0) return { score: 0, connectedCount: 0, depth: 0 }

    const connected = this.findConnectedSignals(signalId, allSignals)
    const connectedInCandidates = connected.filter(c =>
      candidateIds.some(cid => {
        const s = allSignals.find(s => s.id === cid)
        return s && c.includes(this.normalizeSymbol(s.name || ""))
      })
    )

    let depthScore = 0
    let currentLevel = connectedInCandidates
    let depth = 0

    for (let d = 0; d < chainDepth; d++) {
      const nextLevel: string[] = []
      for (const cid of currentLevel) {
        const sig = allSignals.find(s => s.id === cid)
        if (!sig) continue
        const subConnected = this.findConnectedSignals(cid, allSignals)
        for (const sc of subConnected) {
          if (!currentLevel.includes(sc) && !nextLevel.includes(sc)) {
            nextLevel.push(sc)
          }
        }
      }
      if (nextLevel.length > 0) {
        depth++
        depthScore += nextLevel.length * (1 / (d + 1))
        currentLevel = nextLevel
      }
    }

    const score = connectedInCandidates.length + (depth * 0.5)
    return {
      score,
      connectedCount: connectedInCandidates.length,
      depth,
    }
  }

  computeGraphScore(query: string, signal: Signal): GraphScoreResult {
    const intent = extractQueryIntent(query)
    const signalTerms = [signal.name, ...(signal.tags || [])].filter(Boolean) as string[]

    let totalScore = 0
    const matchingEdges: string[] = []
    const edgeConfidences: number[] = []

    for (const queryTerm of intent.expandedTerms) {
      const edges = this.callEdges.get(queryTerm) || []

      for (const edge of edges) {
        let edgeScore = 0

        let weightMultiplier = 1.0

        switch (edge.edgeType) {
          case "static":
            weightMultiplier *= this.options.staticEdgeBoost
            break
          case "dynamic":
            weightMultiplier *= this.options.dynamicEdgePenalty
            break
          case "inferred":
            weightMultiplier *= this.options.inferredEdgePenalty
            break
        }

        if (edge.toResolved) {
          edgeScore += this.options.resolvedSymbolBoost
        } else {
          edgeScore += this.options.unresolvedSymbolPenalty
        }

        edgeScore *= weightMultiplier

        if (signal.file && edge.fromFile === signal.file) {
          edgeScore *= 0.8
        }

        if (edge.text.toLowerCase().includes(queryTerm)) {
          edgeScore *= 1.2
        }

        if (edgeScore > 0) {
          totalScore += edgeScore
          matchingEdges.push(`${edge.fromSymbol} → ${edge.toRaw}`)
          edgeConfidences.push(edge.confidence)
        }
      }
    }

    const confidenceMultiplier = edgeConfidences.length > 0
      ? edgeConfidences.reduce((m, c) => m * c, 1.0)
      : 1.0

    return {
      score: totalScore,
      confidenceMultiplier,
      matchingEdges,
      edgeConfidences,
    }
  }

  computeLocalityScore(signal: Signal, recentFiles: string[]): number {
    if (!recentFiles.length) return 0

    const normalizedSignalFile = signal.file.replace(/\\/g, "/").toLowerCase()

    for (let i = 0; i < recentFiles.length; i++) {
      const recentFile = recentFiles[i].replace(/\\/g, "/").toLowerCase()

      if (normalizedSignalFile.includes(recentFile) || recentFile.includes(normalizedSignalFile)) {
        return (recentFiles.length - i) / recentFiles.length
      }

      const signalParts = normalizedSignalFile.split("/")
      const recentParts = recentFile.split("/")

      let commonParts = 0
      for (let j = 0; j < Math.min(signalParts.length, recentParts.length); j++) {
        if (signalParts[j] === recentParts[j]) {
          commonParts++
        } else {
          break
        }
      }

      if (commonParts >= 2) {
        return (commonParts / Math.max(signalParts.length, recentParts.length)) * 0.5
      }
    }

    return 0
  }

  clear(): void {
    this.callEdges.clear()
    this.symbolToFile.clear()
    this.fileToSymbols.clear()
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.toLowerCase().replace(/[^a-z0-9_.]/g, "")
  }
}

export function computeFinalScore(
  bm25Score: number,
  graphScore: number,
  metadataScore: number,
  localityScore: number,
  lexicalScore: number,
  weights: { bm25Weight: number; graphWeight: number; metadataWeight: number; localityWeight: number; lexicalWeight: number },
  signalConfidence: number,
  edgeConfidences: number[]
): number {
  let finalScore =
    bm25Score * weights.bm25Weight +
    graphScore * weights.graphWeight +
    metadataScore * weights.metadataWeight +
    localityScore * weights.localityWeight +
    lexicalScore * weights.lexicalWeight

  const edgeMultiplier = edgeConfidences.length > 0
    ? edgeConfidences.reduce((m, c) => m * c, 1.0)
    : 1.0

  finalScore *= signalConfidence * edgeMultiplier

  return finalScore
}

export function createGraphScorer(options?: Partial<GraphScoringOptions>): GraphScorer {
  return new GraphScorer(options)
}