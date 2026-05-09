export interface AgentTask {
  taskId: string
  query: string
  goal: string
  expectedFiles: string[]
  expectedSymbols: string[]
  successCriteria: {
    minExpectedSymbolsFound: number
    maxWrongFiles: number
    maxSearchLoops: number
  }
}

export interface AgentExecutionResult {
  taskId: string
  mode: "baseline" | "context-signals"

  filesOpened: string[]
  wrongFilesOpened: string[]
  searchLoops: number
  tokensUsed: number
  timeMs: number

  finalAnswer?: {
    file: string
    line?: number
    explanation: string
  }

  taskSuccess: boolean
  groundTruthFound: boolean
  expectedSymbolsFound: string[]
}

export interface AgentBenchmarkResult {
  project: string
  mode: "baseline" | "context-signals"
  timestamp: number
  results: AgentExecutionResult[]
  summary: {
    totalTasks: number
    taskSuccessRate: number
    groundTruthFoundRate: number
    avgFilesOpened: number
    avgWrongFiles: number
    avgSearchLoops: number
    avgTokensUsed: number
    avgTimeMs: number
  }
}

export interface AgentBenchmarkComparison {
  project: string
  timestamp: number
  baseline: AgentBenchmarkResult
  contextSignals: AgentBenchmarkResult
  comparison: {
    taskSuccessImprovement: number
    filesOpenedReduction: number
    wrongFilesReduction: number
    searchLoopsReduction: number
    tokensReduction: number
    timeImprovement: number
  }
}