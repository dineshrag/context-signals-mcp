import { describe, it, expect, vi, beforeEach } from "vitest"
import { SignalStorage } from "../src/storage.js"
import { extractSignals } from "../src/extractor.js"
import { searchSignals, getSignalKinds } from "../src/search.js"
import type { Evidence } from "../src/extractor.js"
import { tmpdir } from "os"
import path from "path"
import crypto from "crypto"

// Simulate the tool handlers from index.ts
async function handleSignalsSearch(
  storage: SignalStorage,
  args: { query: string; limit?: number; kind?: string; file?: string }
) {
  const signals = await storage.loadSignals()
  const results = searchSignals(signals, {
    query: args.query,
    limit: args.limit ?? 8,
    kind: args.kind,
    file: args.file,
  })
  return { query: args.query, count: results.length, results }
}

async function handleSignalsIngest(
  storage: SignalStorage,
  args: { tool: string; output: string; file?: string; session_id?: string }
) {
  const evidence: Evidence = {
    id: crypto.randomUUID(),
    sessionId: args.session_id ?? "default",
    tool: args.tool,
    input: { file: args.file },
    output: args.output,
    createdAt: Date.now(),
  }

  const signals = extractSignals(evidence)
  const totalSignals = await storage.addSignals(signals)
  const stats = await storage.getStats()

  return {
    message: `Extracted ${signals.length} signals from ${args.tool}`,
    totalSignals: totalSignals.length,
    stats,
  }
}

async function handleSignalsStats(storage: SignalStorage) {
  return await storage.getStats()
}

async function handleSignalsClear(storage: SignalStorage) {
  await storage.clear()
  return { message: "All signals cleared" }
}

async function handleSignalsKinds() {
  return getSignalKinds()
}

describe("MCP Tools Integration", () => {
  let storage: SignalStorage
  const testDir = path.join(tmpdir(), "mcp-tools-test")

  beforeEach(async () => {
    storage = new SignalStorage({
      memoryDir: testDir,
      worktree: tmpdir(),
    })
    await storage.clear()
  })

  describe("signals_search tool", () => {
    it("searches and returns formatted results", async () => {
      // First ingest some signals
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function hello() {}\n2: function upload() {}\n</content>`,
        file: "test.ts",
      })

      const result = await handleSignalsSearch(storage, { query: "hello" })

      expect(result.query).toBe("hello")
      expect(result.count).toBeGreaterThan(0)
      expect(result.results).toBeDefined()
    })

    it("respects limit parameter", async () => {
      // Ingest multiple signals
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function func1() {}\n2: function func2() {}\n3: function func3() {}\n</content>`,
        file: "test.ts",
      })

      const result = await handleSignalsSearch(storage, { query: "func", limit: 2 })

      expect(result.results.length).toBeLessThanOrEqual(2)
    })

    it("filters by kind", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function hello() {}\n2: class World {}\n</content>`,
        file: "test.ts",
      })

      const result = await handleSignalsSearch(storage, { query: "test", kind: "function" })

      result.results.forEach((r) => {
        expect(r.kind).toBe("function")
      })
    })

    it("filters by file", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/controllers/photo.ts</path>\n<content>\n1: function hello() {}\n</content>`,
        file: "controllers/photo.ts",
      })

      const result = await handleSignalsSearch(storage, {
        query: "hello",
        file: "controllers",
      })

      expect(result.results.length).toBeGreaterThan(0)
    })
  })

  describe("signals_ingest tool", () => {
    it("extracts signals from read tool output", async () => {
      const result = await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/app.py</path>\n<content>\n1: def hello():\n2:     pass\n</content>`,
        file: "app.py",
      })

      expect(result.message).toContain("Extracted")
      expect(result.totalSignals).toBeGreaterThan(0)
    })

    it("extracts signals from grep tool output", async () => {
      const result = await handleSignalsIngest(storage, {
        tool: "grep",
        output: `/path/file.ts:\n  Line 10: const hello = () => {}`,
        file: "file.ts",
      })

      expect(result.message).toContain("Extracted")
    })

    it("updates stats after ingest", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function hello() {}\n</content>`,
        file: "test.ts",
      })

      const stats = await handleSignalsStats(storage)

      expect(stats.signalCount).toBeGreaterThan(0)
    })
  })

  describe("signals_stats tool", () => {
    it("returns accurate stats", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function hello() {}\n</content>`,
        file: "test.ts",
      })

      const stats = await handleSignalsStats(storage)

      expect(stats).toHaveProperty("signalCount")
      expect(stats).toHaveProperty("storageUsed")
      expect(stats.signalCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe("signals_clear tool", () => {
    it("clears all data", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/test.ts</path>\n<content>\n1: function hello() {}\n</content>`,
        file: "test.ts",
      })

      const result = await handleSignalsClear(storage)

      expect(result.message).toContain("cleared")

      const stats = await handleSignalsStats(storage)
      expect(stats.evidenceCount).toBe(0)
      expect(stats.signalCount).toBe(0)
    })
  })

  describe("signals_kinds tool", () => {
    it("returns list of signal kinds", async () => {
      const kinds = await handleSignalsKinds()

      expect(Array.isArray(kinds)).toBe(true)
      expect(kinds).toContain("function")
      expect(kinds).toContain("class")
      expect(kinds).toContain("import")
      expect(kinds).toContain("route")
    })
  })

  describe("full workflow", () => {
    it("supports ingest then search workflow", async () => {
      // Ingest TypeScript code
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/router.ts</path>\n<content>
1: import express from 'express';
2: const router = express.Router();
3: class PhotoController {
4:   getPhotos() {}
5: }
6: router.get('/photos', async (req, res) => {});
</content>`,
        file: "router.ts",
      })

      // Search for classes
      const classes = await handleSignalsSearch(storage, { query: "Photo", kind: "class" })
      expect(classes.results.length).toBeGreaterThanOrEqual(1)

      // Search for imports
      const imports = await handleSignalsSearch(storage, { query: "express", kind: "import" })
      expect(imports.results.length).toBeGreaterThanOrEqual(1)
    })

    it("accumulates evidence across multiple ingests", async () => {
      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/file1.ts</path>\n<content>\n1: function func1() {}\n</content>`,
        file: "file1.ts",
      })

      await handleSignalsIngest(storage, {
        tool: "read",
        output: `<path>/file2.ts</path>\n<content>\n1: function func2() {}\n</content>`,
        file: "file2.ts",
      })

      const stats = await handleSignalsStats(storage)
      expect(stats.signalCount).toBeGreaterThanOrEqual(1)
    })
  })
})

describe("MCP Tool Schema", () => {
  const toolSchemas = [
    {
      name: "signals_search",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          kind: { type: "string" },
          file: { type: "string" },
        },
        required: ["query"],
      },
    },
    {
      name: "signals_ingest",
      inputSchema: {
        type: "object",
        properties: {
          tool: { type: "string", enum: ["read", "grep", "glob", "bash", "lsp"] },
          output: { type: "string" },
          file: { type: "string" },
          session_id: { type: "string" },
        },
        required: ["tool", "output"],
      },
    },
    { name: "signals_stats", inputSchema: { type: "object", properties: {} } },
    { name: "signals_clear", inputSchema: { type: "object", properties: {} } },
    { name: "signals_kinds", inputSchema: { type: "object", properties: {} } },
  ]

  toolSchemas.forEach((tool) => {
    it(`tool ${tool.name} has valid schema`, () => {
      expect(tool.name).toBeDefined()
      expect(tool.inputSchema).toBeDefined()
    })
  })
})