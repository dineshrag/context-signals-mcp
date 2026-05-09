import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

interface SessionExport {
  session_id: string
  steps: Array<{
    step: number
    tool: string
    args?: any
    result?: any
    timestamp: string
  }>
  stats?: {
    tokens_used?: number
    duration_ms?: number
  }
}

interface ParsedSession {
  sessionId: string
  filesOpened: string[]
  toolCalls: Array<{ tool: string; args: any }>
  mcpCalls: number
  grepCalls: number
  charsRead: number
  tokensUsed: number
  durationMs: number
}

function parseSessionFile(sessionPath: string): ParsedSession | null {
  try {
    const content = readFileSync(sessionPath, "utf-8")
    const session: SessionExport = JSON.parse(content)

    const filesOpened: string[] = []
    const toolCalls: Array<{ tool: string; args: any }> = []
    let mcpCalls = 0
    let grepCalls = 0
    let charsRead = 0

    for (const step of session.steps || []) {
      toolCalls.push({ tool: step.tool, args: step.args })

      if (step.tool === "read_file" || step.tool === "read") {
        if (step.args?.file && !filesOpened.includes(step.args.file)) {
          filesOpened.push(step.args.file)
        }
        if (step.result?.content) {
          charsRead += step.result.content.length
        }
      }

      if (step.tool === "grep" || step.tool === "search") {
        grepCalls++
      }

      if (step.tool === "context_signals_search" || step.tool === "mcp_search") {
        mcpCalls++
      }
    }

    return {
      sessionId: session.session_id,
      filesOpened,
      toolCalls,
      mcpCalls,
      grepCalls,
      charsRead,
      tokensUsed: session.stats?.tokens_used || 0,
      durationMs: session.stats?.duration_ms || 0,
    }
  } catch (error) {
    console.error(`Failed to parse session ${sessionPath}:`, error)
    return null
  }
}

export function parseAllSessions(sessionsDir: string): ParsedSession[] {
  const results: ParsedSession[] = []

  if (!existsSync(sessionsDir)) {
    console.error(`Sessions directory not found: ${sessionsDir}`)
    return results
  }

  const files = readdirSync(sessionsDir)

  for (const file of files) {
    if (file.endsWith(".json")) {
      const sessionPath = path.join(sessionsDir, file)
      const parsed = parseSessionFile(sessionPath)
      if (parsed) {
        results.push(parsed)
      }
    }
  }

  return results
}

export function aggregateMetrics(sessions: ParsedSession[]): {
  totalSessions: number
  avgFilesOpened: number
  avgMcpCalls: number
  avgGrepCalls: number
  avgCharsRead: number
  avgTokensUsed: number
  sessionsByMode: Record<string, ParsedSession[]>
} {
  const sessionsByMode: Record<string, ParsedSession[]> = {}

  for (const session of sessions) {
    const mode = extractMode(session.sessionId)
    if (!sessionsByMode[mode]) {
      sessionsByMode[mode] = []
    }
    sessionsByMode[mode].push(session)
  }

  const totalSessions = sessions.length
  const avgFilesOpened = sessions.reduce((s, r) => s + r.filesOpened.length, 0) / totalSessions
  const avgMcpCalls = sessions.reduce((s, r) => s + r.mcpCalls, 0) / totalSessions
  const avgGrepCalls = sessions.reduce((s, r) => s + r.grepCalls, 0) / totalSessions
  const avgCharsRead = sessions.reduce((s, r) => s + r.charsRead, 0) / totalSessions
  const avgTokensUsed = sessions.reduce((s, r) => s + r.tokensUsed, 0) / totalSessions

  return {
    totalSessions,
    avgFilesOpened,
    avgMcpCalls,
    avgGrepCalls,
    avgCharsRead,
    avgTokensUsed,
    sessionsByMode,
  }
}

function extractMode(sessionId: string): string {
  if (sessionId.includes("no-mcp")) return "no-mcp"
  if (sessionId.includes("embeddings")) return "cs-embeddings"
  return "cs-deterministic"
}

if (require.main === import.meta.url) {
  const sessionsDir = process.argv[2] || path.join(__dirname, "..", "replays", "session-exports")
  const outputPath = process.argv[3] || path.join(__dirname, "..", "results", "parsed-sessions.json")

  console.log(`Parsing sessions from: ${sessionsDir}`)
  const sessions = parseAllSessions(sessionsDir)
  console.log(`Parsed ${sessions.length} sessions`)

  const metrics = aggregateMetrics(sessions)
  console.log("\nMetrics:")
  console.log(`  Total Sessions: ${metrics.totalSessions}`)
  console.log(`  Avg Files Opened: ${metrics.avgFilesOpened.toFixed(1)}`)
  console.log(`  Avg MCP Calls: ${metrics.avgMcpCalls.toFixed(1)}`)
  console.log(`  Avg Grep Calls: ${metrics.avgGrepCalls.toFixed(1)}`)
  console.log(`  Avg Chars Read: ${metrics.avgCharsRead.toFixed(0)}`)

  for (const [mode, modeSessions] of Object.entries(metrics.sessionsByMode)) {
    const avgFiles = modeSessions.reduce((s, r) => s + r.filesOpened.length, 0) / modeSessions.length
    console.log(`  ${mode}: ${modeSessions.length} sessions, avg files: ${avgFiles.toFixed(1)}`)
  }

  writeFileSync(outputPath, JSON.stringify({ sessions, metrics }, null, 2))
  console.log(`\nResults saved to: ${outputPath}`)
}