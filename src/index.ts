#!/usr/bin/env node

import { getConfig } from "./config.js"
import { createServer, ListToolsRequestSchema, CallToolRequestSchema, StdioServerTransport, Tool } from "./server.js"
import { FileScanner } from "./scanner/file-scanner.js"
import { IncrementalScanner } from "./scanner/incremental-scanner.js"
import { EvidenceStore, SignalStore, IndexStore, MetricsStore } from "./storage/index.js"
import { extract, detectLanguage } from "./extractors/index.js"
import { createEvidence } from "./types/evidence.js"
import { searchSignals, getSignalKinds } from "./search.js"
import { runBenchmarkSuite } from "./benchmark/benchmark-suite.js"

const config = getConfig()
const scanner = new FileScanner()
const evidenceStore = new EvidenceStore(config.memoryDir)
const signalStore = new SignalStore(config.memoryDir)
const indexStore = new IndexStore(config.memoryDir)
const metricsStore = new MetricsStore(config.memoryDir)
const incrementalScanner = new IncrementalScanner(indexStore)

function getStorageStatus(reductionPercent: number): string {
  if (reductionPercent >= 90) return "Exceptional"
  if (reductionPercent >= 70) return "Strong"
  if (reductionPercent >= 50) return "Moderate"
  if (reductionPercent >= 10) return "Minimal"
  return "Below Threshold"
}

function getRetrievalStatus(top3HitRate: number): string {
  if (top3HitRate >= 80) return "Excellent"
  if (top3HitRate >= 60) return "Good"
  if (top3HitRate >= 40) return "Moderate"
  if (top3HitRate >= 20) return "Poor"
  return "Below Threshold"
}

function getBreakEvenStatus(breakEvenQueries: number): string {
  if (breakEvenQueries < 100) return "On Track"
  if (breakEvenQueries < 500) return "Moderate"
  if (breakEvenQueries < 1000) return "Extended"
  return "At Risk"
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return `${days} day${days === 1 ? "" : "s"} ago`
}

const tools: Tool[] = [
  {
    name: "signals_search",
    description: "Search context signals BEFORE reading files. When user asks 'where is X?', 'find X', 'show routes', 'list functions' - ALWAYS call this first. This returns file paths and line numbers WITHOUT reading files. Use for: function locations, class definitions, routes, imports, handlers, middleware.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'upload endpoint', 'router', 'database model', 'login function', 'API routes')",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10)",
          default: 10,
        },
        kind: {
          type: "string",
          description: "Filter by signal type",
        },
        file: {
          type: "string",
          description: "Filter by file path substring",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "signals_ingest",
    description: "Extract signals from code AFTER reading files. ALWAYS call this after any file read, grep, glob, or bash command that shows code. This builds the searchable index. Call after: file reads, grep results, glob output.",
    inputSchema: {
      type: "object",
      properties: {
        tool: {
          type: "string",
          description: "Tool name (read, grep, glob, bash, lsp)",
          enum: ["read", "grep", "glob", "bash", "lsp"],
        },
        output: {
          type: "string",
          description: "Tool output content to extract signals from",
        },
        file: {
          type: "string",
          description: "File path associated with the tool output",
        },
        session_id: {
          type: "string",
          description: "Session identifier",
          default: "default",
        },
      },
      required: ["tool", "output"],
    },
  },
  {
    name: "signals_stats",
    description: "Get statistics about stored signals",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "signals_clear",
    description: "Clear all stored signals (use with caution)",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "signals_kinds",
    description: "List available signal kinds for filtering",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "signals_scan",
    description: "SCAN all code files in the workspace. Always call this ONCE at the start of a session to build the index. Recursively scans: src/, lib/, app/, routes/, controllers/, models/, pages/, components/. Extracts all functions, classes, routes, imports in one pass.",
    inputSchema: {
      type: "object",
      properties: {
        extensions: {
          type: "array",
          description: "File extensions to scan",
          items: { type: "string" },
          default: [".ts", ".js", ".tsx", ".jsx"],
        },
        exclude: {
          type: "array",
          description: "Folders to exclude",
          items: { type: "string" },
          default: ["node_modules", "dist", "build", ".next", ".git"],
        },
        force: {
          type: "boolean",
          description: "Force re-scan of all files",
          default: false,
        },
      },
    },
  },
  {
    name: "signals_benchmark",
    description: "Run benchmark evaluation on a fixture. Use 'default' for built-in queries or provide custom queries. Returns metrics: storage efficiency, query context reduction, accuracy, retrieval quality, break-even analysis.",
    inputSchema: {
      type: "object",
      properties: {
        fixture: {
          type: "string",
          description: "Fixture name (e.g., 'express-app', 'fastify-app')",
          default: "express-app",
        },
        fixturePath: {
          type: "string",
          description: "Path to fixture directory",
          default: "./benchmarks/fixtures/express-app",
        },
        outputDir: {
          type: "string",
          description: "Directory to save results",
          default: "./benchmarks/results",
        },
      },
    },
  },
]

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "signals_search": {
      const signals = await signalStore.load()
      const results = searchSignals(signals, {
        query: String(args.query),
        limit: Number(args.limit ?? 8),
        kind: args.kind ? String(args.kind) : undefined,
        file: args.file ? String(args.file) : undefined,
      })

      await metricsStore.recordSearch(String(args.query), results.length)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                query: args.query,
                count: results.length,
                results,
              },
              null,
              2
            ),
          },
        ],
      }
    }

    case "signals_ingest": {
      const tool = String(args.tool)
      const output = String(args.output)
      const file = args.file ? String(args.file) : undefined
      const sessionId = String(args.session_id ?? "default")

      const evidence = createEvidence({
        sourceType: "tool",
        file,
        rawSize: output.length,
        metadata: { tool, sessionId, output },
      })

      const extractionResult = extract(output, file ?? "", evidence)
      const signals = extractionResult.signals

      const result = await signalStore.addSignalsWithStats(signals)
      const stats = await signalStore.getStats(result.totalChars)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Extracted ${signals.length} signals from ${tool}`,
                signalsCreated: result.signalsCreated,
                signalsUpdated: result.signalsUpdated,
                totalSignals: result.signals.length,
                stats,
              },
              null,
              2
            ),
          },
        ],
      }
    }

    case "signals_stats": {
      const indexMeta = await indexStore.load()
      const rawSourceChars = indexMeta?.rawSourceChars ?? 0
      const stats = await signalStore.getStats(rawSourceChars)
      const searchStats = await metricsStore.getSearchStats()

      const storageReduction = stats.storageReductionPercent
      const storageStatus = getStorageStatus(storageReduction)

      const retrievalStatus = getRetrievalStatus(searchStats.top3HitRate)

      const avgSavingsPerQuery = rawSourceChars > 0 && searchStats.totalSearches > 0
        ? Math.round(rawSourceChars / searchStats.totalSearches)
        : 0
      const breakEvenQueries = avgSavingsPerQuery > 0
        ? Math.round(stats.rawSourceChars / avgSavingsPerQuery)
        : 0
      const breakEvenStatus = getBreakEvenStatus(breakEvenQueries)

      const perQueryBaseline = rawSourceChars > 0 ? Math.round(rawSourceChars / (indexMeta?.totalFiles || 1)) : 0
      const perQueryMCP = Math.round(stats.signalChars / (indexMeta?.totalFiles || 1))
      const tokenSavingsPercent = perQueryBaseline > 0
        ? Math.round(((perQueryBaseline - perQueryMCP) / perQueryBaseline) * 100)
        : 0

      const lastIndexedTimestamp = indexMeta?.lastIndexedAt ?? null
      const lastIndexedAt = lastIndexedTimestamp
        ? new Date(lastIndexedTimestamp).toISOString()
        : null
      const indexAge = lastIndexedTimestamp
        ? getRelativeTime(lastIndexedTimestamp)
        : null

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              indexHealth: {
                filesIndexed: indexMeta?.totalFiles ?? 0,
                totalSignals: stats.count,
                lastIndexed: lastIndexedAt,
                indexAge,
              },
              storageEfficiency: {
                rawSourceChars: stats.rawSourceChars,
                signalChars: stats.signalChars,
                reductionPercent: storageReduction,
                status: storageStatus,
              },
              tokenSavings: {
                estimatedReduction: `${tokenSavingsPercent}%`,
                perQueryBaseline: `${perQueryBaseline} tokens`,
                perQueryMCP: `${perQueryMCP} tokens`,
                savingsPerQuery: `${perQueryBaseline - perQueryMCP} tokens`,
              },
              retrievalQuality: {
                totalSearches: searchStats.totalSearches,
                avgResultsPerQuery: searchStats.avgResultsPerQuery,
                top3HitRate: searchStats.top3HitRate,
                zeroResultQueries: searchStats.zeroResultQueries,
                status: retrievalStatus,
              },
              breakEven: {
                indexingChars: stats.rawSourceChars,
                avgSavingsPerQuery,
                breakEvenQueries,
                status: breakEvenStatus,
              },
              byKind: stats.byKind,
              byLanguage: stats.byLanguage,
              byFramework: stats.byFramework,
            }, null, 2),
          },
        ],
      }
    }

    case "signals_clear": {
      await signalStore.clear()
      await evidenceStore.clear()
      await indexStore.clear()
      await indexStore.clearPerFileMeta()
      await metricsStore.clear()
      scanner.clearCache()
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ message: "All signals cleared" }),
          },
        ],
      }
    }

    case "signals_kinds": {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(getSignalKinds(), null, 2),
          },
        ],
      }
    }

    case "signals_scan": {
      const force = Boolean(args.force ?? false)
      const exclude = (args.exclude as string[] ?? ["node_modules", "dist", "build", ".next", ".git"]) as string[]

      const startTime = Date.now()
      let filesScanned = 0
      let filesSkipped = 0
      let filesRemoved = 0
      let signalsCreated = 0
      let signalsUpdated = 0
      let rawSourceChars = 0
      let signalChars = 0
      const errors: string[] = []

      const scanOptions = {
        root: config.worktree,
        force,
        exclude,
      }

      const scanResult = await incrementalScanner.scan(scanOptions)
      const hasExistingMeta = await incrementalScanner.hasExistingMeta()

      if (!hasExistingMeta && !force) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                filesScanned: 0,
                filesSkipped: scanResult.totalFiles,
                filesRemoved: 0,
                signalsCreated: 0,
                signalsUpdated: 0,
                rawSourceChars: 0,
                signalChars: 0,
                storageReductionPercent: 0,
                scanMode: "incremental",
                message: "No existing index metadata found. Run with force:true to perform full scan.",
                errors: [],
              }, null, 2),
            },
          ],
        }
      }

      for (const file of scanResult.filesToRemove) {
        await incrementalScanner.removeMetaForFile(file)
        const fileSignals = await signalStore.getByFile(file)
        if (fileSignals.length > 0) {
          const allSignals = await signalStore.load()
          const filtered = allSignals.filter(s => s.file !== file)
          await signalStore.save(filtered)
          filesRemoved++
        }
      }

      const filesToProcess = await incrementalScanner.getFilesToIndex(scanOptions)

      for (const { file, content, meta, evidence } of filesToProcess) {
        try {
          await evidenceStore.save(evidence)

          const evidenceData = createEvidence({
            sourceType: "file",
            file: file,
            contentHash: meta.hash,
            rawSize: content.length,
            metadata: { sessionId: "scan" },
          })

          const extractionResult = extract(content, file, evidenceData)
          const signals = extractionResult.signals

          const result = await signalStore.addSignalsWithStats(signals)

          await incrementalScanner.updateMetaForFile(file, meta)

          filesScanned++
          signalsCreated += result.signalsCreated
          signalsUpdated += result.signalsUpdated
          rawSourceChars += content.length
          signalChars += result.totalChars
        } catch (error) {
          errors.push(`Failed to process ${file}: ${error}`)
        }
      }

      filesSkipped = scanResult.filesUnchanged.length

      const storageReductionPercent = rawSourceChars > 0
        ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
        : 0

      await indexStore.update({
        lastIndexedAt: Date.now(),
        totalFiles: scanResult.totalFiles,
        totalSignals: signalsCreated,
        rawSourceChars,
        signalChars,
      })

      await metricsStore.updateLastIndexed(rawSourceChars)

      const durationMs = Date.now() - startTime

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              filesScanned,
              filesSkipped,
              filesRemoved,
              signalsCreated,
              signalsUpdated,
              rawSourceChars,
              signalChars,
              storageReductionPercent,
              durationMs,
              scanMode: force ? "full" : "incremental",
              errors: errors.slice(0, 10),
            }, null, 2),
          },
        ],
      }
    }

    case "signals_benchmark": {
      const fixtureName = String(args.fixture ?? "express-app")
      const fixturePath = String(args.fixturePath ?? `./benchmarks/fixtures/${fixtureName}`)
      const outputDir = String(args.outputDir ?? "./benchmarks/results")

      const result = await runBenchmarkSuite({
        fixtureName,
        fixturePath,
        outputDir,
      })

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              status: result.passed ? "PASSED" : "FAILED",
              fixture: result.fixture,
              metrics: result.metrics,
              summary: {
                storageReduction: `${result.metrics.storage.reductionPercent}%`,
                queryContextReduction: `${result.metrics.queryContext.reductionPercent}%`,
                accuracyChange: `${result.metrics.accuracy.baselineAvg.toFixed(2)} -> ${result.metrics.accuracy.signalsAvg.toFixed(2)}`,
                retrievalQuality: `${result.metrics.retrieval.top3HitRate}%`,
                breakEvenQueries: result.metrics.breakEven.breakEvenQueries,
              },
            }, null, 2),
          },
        ],
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

const server = createServer({
  name: "context-signals-mcp",
  version: "1.0.0",
})

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const result = await handleToolCall(request.params.name, request.params.arguments ?? {})
    return result
  } catch (error) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    }
  }
})

async function ensureWarmCache(): Promise<void> {
  try {
    const signals = await signalStore.load()
    const hasMeta = await incrementalScanner.hasExistingMeta()

    if (signals.length === 0 && !hasMeta) {
      console.error("Auto-index: No existing index found. Starting background indexing...")

      const scanOptions = {
        root: config.worktree,
        force: false,
        exclude: ["node_modules", "dist", "build", ".next", ".git"],
      }

      const scanResult = await incrementalScanner.scan(scanOptions)

      if (scanResult.totalFiles === 0) {
        console.error("Auto-index: No files found to index.")
        return
      }

      console.error(`Auto-index: Found ${scanResult.totalFiles} files. Indexing...`)

      const filesToProcess = await incrementalScanner.getFilesToIndex(scanOptions)
      let indexedCount = 0
      let rawSourceChars = 0
      let signalChars = 0

      for (const { file, content, meta, evidence } of filesToProcess) {
        await evidenceStore.save(evidence)

        const evidenceData = createEvidence({
          sourceType: "file",
          file: file,
          contentHash: meta.hash,
          rawSize: content.length,
          metadata: { sessionId: "auto-index" },
        })

        const extractionResult = extract(content, file, evidenceData)
        const sigs = extractionResult.signals
        const result = await signalStore.addSignalsWithStats(sigs)
        await incrementalScanner.updateMetaForFile(file, meta)
        indexedCount++
        rawSourceChars += content.length
        signalChars += result.totalChars
      }

      const allSignals = await signalStore.load()

      await indexStore.update({
        lastIndexedAt: Date.now(),
        totalFiles: scanResult.totalFiles,
        totalSignals: allSignals.length,
        rawSourceChars,
        signalChars,
      })

      await metricsStore.updateLastIndexed(rawSourceChars)

      console.error(`Auto-index: Complete. Indexed ${indexedCount} files with ${allSignals.length} signals.`)
    } else if (hasMeta) {
      const scanOptions = {
        root: config.worktree,
        force: false,
        exclude: ["node_modules", "dist", "build", ".next", ".git"],
      }
      const scanResult = await incrementalScanner.scan(scanOptions)
      const changedCount = scanResult.filesToIndex.length
      const removedCount = scanResult.filesToRemove.length

      if (changedCount > 0 || removedCount > 0) {
        console.error(`Auto-index: ${changedCount} files changed, ${removedCount} removed. Run signals_scan for incremental update.`)
      } else {
        console.error("Auto-index: Cache warm. No changes detected.")
      }
    } else {
      console.error("Auto-index: Signals exist but no metadata. Run signals_scan with force:true to rebuild index.")
    }
  } catch (error) {
    console.error(`Auto-index error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  await ensureWarmCache()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Context Signals MCP server running on stdio")
}

main().catch(console.error)