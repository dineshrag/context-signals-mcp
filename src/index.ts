#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js"
import path from "path"
import crypto from "crypto"
import { SignalStorage } from "./storage.js"
import { extractSignals, detectLanguage, type Evidence } from "./extractor.js"
import { searchSignals, getSignalKinds } from "./search.js"

const WORKTREE = process.env.WORKTREE ?? process.cwd()
const MEMORY_DIR = path.join(WORKTREE, ".crush-memory", "signals")

const storage = new SignalStorage({
  memoryDir: MEMORY_DIR,
  worktree: WORKTREE,
})

const tools: Tool[] = [
  {
    name: "signals_search",
    description: "Search context signals extracted from previous file reads. Use this before re-reading files to check if the information is already in memory.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'upload endpoint', 'router', 'database model')",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 8)",
          default: 8,
        },
        kind: {
          type: "string",
          description: "Filter by signal type",
          enum: getSignalKinds(),
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
    description: "Extract and store signals from tool output (read, grep, glob). This is called automatically by the agent when running file operations.",
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
          description: "Optional file path associated with the tool output",
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
]

async function handleToolCall(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "signals_search": {
      const signals = await storage.loadSignals()
      const results = searchSignals(signals, {
        query: String(args.query),
        limit: Number(args.limit ?? 8),
        kind: args.kind ? String(args.kind) : undefined,
        file: args.file ? String(args.file) : undefined,
      })

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

      const evidence: Evidence = {
        id: crypto.randomUUID(),
        sessionId,
        tool,
        input: { file },
        output,
        createdAt: Date.now(),
      }

      const signals = extractSignals(evidence)
      const totalSignals = await storage.addSignals(signals)
      const stats = await storage.getStats()

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                message: `Extracted ${signals.length} signals from ${tool}`,
                totalSignals: totalSignals.length,
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
      const stats = await storage.getStats()
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(stats, null, 2),
          },
        ],
      }
    }

    case "signals_clear": {
      await storage.clear()
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

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

const server = new Server(
  {
    name: "context-signals-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

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

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Context Signals MCP server running on stdio")
}

main().catch(console.error)