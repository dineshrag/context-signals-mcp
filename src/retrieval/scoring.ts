import type { Signal } from "../types/signal.js"

export interface ScoringOptions {
  exactNameBoost: number
  routePathBoost: number
  routeMethodBoost: number
  fileBasenameBoost: number
  tagsBoost: number
  textBoost: number
  minScore: number
}

export const DEFAULT_SCORING_OPTIONS: ScoringOptions = {
  exactNameBoost: 4,
  routePathBoost: 4,
  routeMethodBoost: 4,
  fileBasenameBoost: 2,
  tagsBoost: 3,
  textBoost: 1,
  minScore: 0.1,
}

export interface ScoredResult<T> {
  item: T
  score: number
  breakdown?: ScoreBreakdown
}

export interface ScoreBreakdown {
  nameScore: number
  routeScore: number
  fileScore: number
  tagsScore: number
  textScore: number
  finalScore: number
}

export function computeScore(signal: Signal, query: string, options: Partial<ScoringOptions> = {}): number {
  const opts = { ...DEFAULT_SCORING_OPTIONS, ...options }

  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/)

  let nameScore = 0
  let routeScore = 0
  let fileScore = 0
  let tagsScore = 0
  let textScore = 0

  if (signal.name) {
    const nameLower = signal.name.toLowerCase()

    if (nameLower === queryLower) {
      nameScore = opts.exactNameBoost * 2
    } else if (nameLower.includes(queryLower)) {
      nameScore = opts.exactNameBoost
    } else {
      for (const term of queryTerms) {
        if (nameLower.includes(term)) {
          nameScore += opts.exactNameBoost * 0.5
        }
      }
    }
  }

  if (signal.route) {
    const pathLower = signal.route.path?.toLowerCase() ?? ""
    const methodLower = signal.route.method?.toLowerCase() ?? ""

    if (pathLower && queryLower.includes(pathLower)) {
      routeScore += opts.routePathBoost
    } else if (pathLower) {
      for (const term of queryTerms) {
        if (pathLower.includes(term)) {
          routeScore += opts.routePathBoost * 0.3
        }
      }
    }

    if (methodLower && queryLower.includes(methodLower)) {
      routeScore += opts.routeMethodBoost * 0.5
    }
  }

  if (signal.file) {
    const fileParts = signal.file.split(/[/\\]/)
    const basename = fileParts[fileParts.length - 1]?.toLowerCase() ?? ""

    if (basename && queryLower.includes(basename)) {
      fileScore += opts.fileBasenameBoost
    }

    for (const term of queryTerms) {
      if (basename.includes(term)) {
        fileScore += opts.fileBasenameBoost * 0.3
      }
    }
  }

  if (signal.tags) {
    for (const tag of signal.tags) {
      const tagLower = tag.toLowerCase()
      for (const term of queryTerms) {
        if (tagLower === term) {
          tagsScore += opts.tagsBoost * 0.5
        } else if (tagLower.includes(term)) {
          tagsScore += opts.tagsBoost * 0.2
        }
      }
    }
  }

  if (signal.text) {
    const textLower = signal.text.toLowerCase()
    for (const term of queryTerms) {
      if (textLower.includes(term)) {
        textScore += opts.textBoost * 0.3
      }
    }
  }

  return nameScore + routeScore + fileScore + tagsScore + textScore
}

export function scoreAndSort<T>(
  items: T[],
  query: string,
  getSignal: (item: T) => Signal,
  options: Partial<ScoringOptions> = {}
): ScoredResult<T>[] {
  const scored = items.map(item => {
    const signal = getSignal(item)
    const score = computeScore(signal, query, options)
    return { item, score }
  })

  return scored
    .filter(s => s.score >= (options.minScore ?? DEFAULT_SCORING_OPTIONS.minScore))
    .sort((a, b) => b.score - a.score)
}

export function rerankWithScoring<T>(
  results: T[],
  query: string,
  getSignal: (item: T) => Signal,
  options: Partial<ScoringOptions> = {}
): ScoredResult<T>[] {
  return scoreAndSort(results, query, getSignal, options)
}

export function normalizeScores(results: ScoredResult<any>[]): ScoredResult<any>[] {
  if (results.length === 0) return results

  const maxScore = Math.max(...results.map(r => r.score))
  if (maxScore === 0) return results

  return results.map(r => ({
    ...r,
    score: Number((r.score / maxScore).toFixed(2)),
  }))
}