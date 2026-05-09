export interface AgentTask {
  id: string
  query: string
  expectedFile: string
  expectedLine?: number
  expectedContent: string
  validationType: "file_match" | "line_content" | "regex_match" | "multi_file"
}

export interface AgentTaskResult {
  taskId: string
  query: string
  mode: "baseline" | "context-signals"

  filesOpened: string[]
  tokensRead: number
  iterations: number
  searchLoops: number
  timeMs: number

  answerFile?: string
  answerLine?: number
  answerContent?: string

  correct: boolean
  wrongFilesOpened: string[]

  contextReduction: number
}

export interface AgentBenchmarkResult {
  project: string
  timestamp: number
  tasks: AgentTask[]
  mode: "baseline" | "context-signals"
  results: AgentTaskResult[]
  summary: {
    totalTasks: number
    correctAnswers: number
    accuracy: number
    avgFilesOpened: number
    avgTokensRead: number
    avgIterations: number
    avgSearchLoops: number
    avgTimeMs: number
    contextReduction: number
  }
}

export interface AgentBenchmarkComparison {
  project: string
  timestamp: number
  baseline: AgentBenchmarkResult
  contextSignals: AgentBenchmarkResult
  comparison: {
    accuracyImprovement: number
    filesOpenedReduction: number
    tokensReadReduction: number
    iterationsReduction: number
    timeImprovement: number
    contextReductionImprovement: number
  }
}