export interface BenchmarkQuery {
  query: string
  expected: {
    kind?: string
    method?: string
    path?: string
    fileContains?: string
    requiresLine?: boolean
  }
}

export interface BenchmarkResult {
  queriesRun: number
  correct: number
  accuracyPercent: number
  baselineChars: number
  signalChars: number
  indexingChars: number
  breakEvenQueries: number
  details?: Array<{
    query: string
    score: number
    correct: boolean
  }>
}

export interface BenchmarkConfig {
  queries: "default" | BenchmarkQuery[]
  includeIndexingCost: boolean
  repoPath?: string
}