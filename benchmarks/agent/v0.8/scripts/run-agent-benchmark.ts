import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { spawnSync, execSync } from "child_process"
import process from "process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface Task {
  taskId: string
  question: string
  expectedFiles: string[]
  expectedSymbols: string[]
  successCriteria: {
    minExpectedFilesFound: number
    minExpectedSymbolsFound: number
    maxWrongFiles: number
  }
}

interface AgentResult {
  taskId: string
  mode: "no-mcp" | "cs-deterministic" | "cs-embeddings"
  runNumber: number
  filesOpened: string[]
  wrongFilesOpened: string[]
  toolCalls: number
  mcpCalls: number
  charsRead: number
  timeMs: number
  taskSuccess: boolean
  expectedFilesFound: string[]
  expectedSymbolsFound: string[]
  finalAnswer: string
  error?: string
}

const MODES = ["no-mcp", "cs-deterministic", "cs-embeddings"] as const
const REPEATS = 1
const RUN_TIMEOUT_MS = 180000

function loadTasks(): Task[] {
  const tasksPath = path.join(__dirname, "..", "tasks", "v0.8-tasks.json")
  const content = readFileSync(tasksPath, "utf-8")
  const data = JSON.parse(content)
  return data.tasks
}

function getConfigPath(mode: string): string {
  const configsDir = path.join(__dirname, "..", "configs")
  switch (mode) {
    case "no-mcp":
      return path.join(configsDir, "opencode.no-mcp.jsonc")
    case "cs-deterministic":
      return path.join(configsDir, "opencode.with-mcp.jsonc")
    case "cs-embeddings":
      return path.join(configsDir, "opencode.with-embeddings.jsonc")
    default:
      throw new Error(`Unknown mode: ${mode}`)
  }
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").toLowerCase()
}

function checkExpectedFiles(filesOpened: string[], expectedFiles: string[]): string[] {
  const found: string[] = []
  for (const expected of expectedFiles) {
    const normalizedExpected = expected.toLowerCase()
    if (filesOpened.some(f => normalizeFilePath(f).includes(normalizedExpected))) {
      found.push(expected)
    }
  }
  return found
}

function runAgentTask(
  task: Task,
  mode: string,
  runNumber: number,
  repoPath: string
): AgentResult {
  const startTime = Date.now()
  const configPath = getConfigPath(mode)
  const taskId = `v08-${task.taskId}-${mode}-r${runNumber}-${Date.now()}`

  const prompt = `${task.question} [Session: ${taskId}]`

  console.log(`  Running ${task.taskId} (${mode}) run ${runNumber}...`)

  let opencodeOutput = ""
  let errorMsg = ""

  try {
    const dirArg = repoPath.replace(/\\/g, "/")
    const configArg = configPath.replace(/\\/g, "/")

    const batPath = path.join(process.env.TEMP || "/tmp", `oc-${Date.now()}.bat`)
    let batchContent = `@echo off\n`
    batchContent += `opencode run "${prompt}" -m "opencode/minimax-m2.7" --session "${taskId}" --config "${configArg}" --dir "${dirArg}"\n`

    require("fs").writeFileSync(batPath, batchContent)

    const result = spawnSync("cmd", ["/c", batPath], {
      encoding: "utf-8",
      timeout: RUN_TIMEOUT_MS,
      maxBuffer: 10 * 1024 * 1024
    })

    opencodeOutput = (result.stdout || "") + (result.stderr || "")
    if (result.status !== 0) {
      errorMsg = `Exit code: ${result.status}`
    }

    try { require("fs").unlinkSync(batPath) } catch {}
  } catch (e: any) {
    errorMsg = e.message || "Unknown error"
  }

  const timeMs = Date.now() - startTime

  return {
    taskId: task.taskId,
    mode: mode as any,
    runNumber,
    filesOpened: [],
    wrongFilesOpened: [],
    toolCalls: 0,
    mcpCalls: mode !== "no-mcp" ? 1 : 0,
    charsRead: opencodeOutput.length,
    timeMs,
    taskSuccess: false,
    expectedFilesFound: [],
    expectedSymbolsFound: [],
    finalAnswer: opencodeOutput.substring(0, 500),
    error: errorMsg
  }
}

function exportSessionData(sessionId: string): any {
  try {
    const result = execSync(`opencode export ${sessionId} --format json --sanitize`, {
      encoding: "utf-8",
      timeout: 30000,
      maxBuffer: 50 * 1024 * 1024
    })
    return JSON.parse(result)
  } catch (e: any) {
    return null
  }
}

function extractFilesFromSession(sessionData: any): string[] {
  const files: string[] = []
  if (!sessionData || !sessionData.messages) return files

  for (const msg of sessionData.messages) {
    if (msg.parts) {
      for (const part of msg.parts) {
        if (part.type === "tool-call" && part.tool === "read_file") {
          const file = part.args?.file
          if (file && !files.includes(file)) {
            files.push(file)
          }
        }
      }
    }
  }
  return files
}

function evaluateResult(result: AgentResult, task: Task, sessionData: any): AgentResult {
  const files = sessionData ? extractFilesFromSession(sessionData) : []
  result.filesOpened = files

  const expectedFilesFound = checkExpectedFiles(files, task.expectedFiles)

  let expectedSymbolsFound: string[] = []
  const fullText = sessionData ? JSON.stringify(sessionData) : result.finalAnswer
  for (const symbol of task.expectedSymbols) {
    if (fullText.includes(symbol)) {
      expectedSymbolsFound.push(symbol)
    }
  }

  const wrongFiles: string[] = []
  for (const file of files) {
    const normalizedFile = normalizeFilePath(file)
    const isExpected = task.expectedFiles.some(ef => normalizedFile.includes(ef.toLowerCase()))
    if (!isExpected) {
      wrongFiles.push(file)
    }
  }

  result.expectedFilesFound = expectedFilesFound
  result.expectedSymbolsFound = expectedSymbolsFound
  result.wrongFilesOpened = wrongFiles
  result.taskSuccess = expectedFilesFound.length >= task.successCriteria.minExpectedFilesFound &&
                       expectedSymbolsFound.length >= task.successCriteria.minExpectedSymbolsFound

  return result
}

function ensureResultsDir(): string {
  const resultsDir = path.join(__dirname, "..", "results")
  if (!existsSync(resultsDir)) {
    mkdirSync(resultsDir, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/:/g, "-")
  const runDir = path.join(resultsDir, `run-${timestamp}`)
  mkdirSync(runDir, { recursive: true })
  return runDir
}

export async function runAgentBenchmark(repoPath: string): Promise<void> {
  const tasks = loadTasks()
  const runDir = ensureResultsDir()

  console.log("\n" + "=".repeat(60))
  console.log("v0.8 AGENT NAVIGATION BENCHMARK")
  console.log("=".repeat(60))
  console.log(`\nRepo: ${repoPath}`)
  console.log(`Tasks: ${tasks.length}`)
  console.log(`Modes: ${MODES.join(", ")}`)
  console.log(`Repeats: ${REPEATS}`)
  console.log(`Model: opencode/minimax-m2.7`)
  console.log(`Results: ${runDir}`)
  console.log("=".repeat(60))

  const results: AgentResult[] = []

  for (const task of tasks) {
    console.log(`\nTask: ${task.taskId} - ${task.question.substring(0, 60)}...`)

    for (const mode of MODES) {
      for (let run = 1; run <= REPEATS; run++) {
        const rawResult = runAgentTask(task, mode, run, repoPath)

        const sessionId = rawResult.finalAnswer.match(/\[Session: (v08-[^\]]+)\]/)?.[1]
        if (sessionId) {
          console.log(`    Session: ${sessionId}`)
          const sessionData = exportSessionData(sessionId)
          const evaluatedResult = evaluateResult(rawResult, task, sessionData)
          results.push(evaluatedResult)

          const status = evaluatedResult.taskSuccess ? "SUCCESS" : "FAIL"
          const files = evaluatedResult.filesOpened.length
          const wrong = evaluatedResult.wrongFilesOpened.length
          const expectedFounds = evaluatedResult.expectedFilesFound.length
          console.log(`  ${mode} run ${run}: ${status} (${files} files, ${wrong} wrong, ${expectedFounds}/${task.expectedFiles.length} expected found)`)
        } else {
          console.log(`  ${mode} run ${run}: FAIL (no session captured)`)
          results.push(rawResult)
        }
      }
    }
  }

  saveResults(results, runDir)
  printSummary(results)
}

function saveResults(results: AgentResult[], runDir: string): void {
  const outputPath = path.join(runDir, "agent-results.json")
  writeFileSync(outputPath, JSON.stringify({ results, timestamp: new Date().toISOString() }, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)
}

function printSummary(results: AgentResult[]): void {
  console.log("\n" + "=".repeat(60))
  console.log("BENCHMARK SUMMARY")
  console.log("=".repeat(60))

  for (const mode of MODES) {
    const modeResults = results.filter(r => r.mode === mode)
    const successRate = modeResults.filter(r => r.taskSuccess).length / modeResults.length
    const avgFilesOpened = modeResults.reduce((s, r) => s + r.filesOpened.length, 0) / modeResults.length
    const avgWrongFiles = modeResults.reduce((s, r) => s + r.wrongFilesOpened.length, 0) / modeResults.length

    console.log(`\n${mode.toUpperCase()}:`)
    console.log(`  Task Success: ${(successRate * 100).toFixed(0)}%`)
    console.log(`  Avg Files Opened: ${avgFilesOpened.toFixed(1)}`)
    console.log(`  Avg Wrong Files: ${avgWrongFiles.toFixed(1)}`)
  }

  const noMcpResults = results.filter(r => r.mode === "no-mcp")
  const csResults = results.filter(r => r.mode === "cs-deterministic")

  if (csResults.length > 0 && noMcpResults.length > 0) {
    const noMcpSuccessRate = noMcpResults.filter(r => r.taskSuccess).length / noMcpResults.length
    const csSuccessRate = csResults.filter(r => r.taskSuccess).length / csResults.length
    const noMcpAvgWrong = noMcpResults.reduce((s, r) => s + r.wrongFilesOpened.length, 0) / noMcpResults.length
    const csAvgWrong = csResults.reduce((s, r) => s + r.wrongFilesOpened.length, 0) / csResults.length

    const wrongReduction = noMcpAvgWrong > 0 ? ((noMcpAvgWrong - csAvgWrong) / noMcpAvgWrong * 100) : 0

    console.log("\n" + "=".repeat(60))
    console.log("COMPARISON: no-MCP vs CS-deterministic")
    console.log("=".repeat(60))
    console.log(`  Task Success: ${(noMcpSuccessRate * 100).toFixed(0)}% → ${(csSuccessRate * 100).toFixed(0)}%`)
    console.log(`  Wrong Files: ${noMcpAvgWrong.toFixed(1)} → ${csAvgWrong.toFixed(1)} (${wrongReduction.toFixed(0)}% reduction)`)
    console.log("\n  GO/NO-GO:")
    if (wrongReduction >= 25 && csSuccessRate >= noMcpSuccessRate) {
      console.log(`    GO - >=25% wrong file reduction, same/better success`)
    } else if (wrongReduction >= 15 && csSuccessRate >= noMcpSuccessRate - 0.1) {
      console.log(`    MARGINAL - partial improvement`)
    } else {
      console.log(`    NO-GO - criteria not met`)
    }
  }
}

const repoPath = process.argv[2] || "benchmarks/repos/litellm-live"
runAgentBenchmark(repoPath).catch(console.error)