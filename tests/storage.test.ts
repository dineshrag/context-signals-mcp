import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { SignalStorage } from "../src/storage.js"
import type { Signal, Evidence } from "../src/extractor.js"
import { tmpdir } from "os"
import path from "path"

describe("SignalStorage", () => {
  let storage: SignalStorage
  const testDir = path.join(tmpdir(), "mcp-storage-test")

  beforeEach(() => {
    storage = new SignalStorage({
      memoryDir: testDir,
      worktree: tmpdir(),
    })
  })

  afterEach(async () => {
    await storage.clear()
  })

  describe("saveSignals / loadSignals", () => {
    it("saves and loads signals", async () => {
      const signals: Signal[] = [
        {
          id: "sig-1",
          evidenceId: "ev-1",
          sessionId: "session-1",
          kind: "function",
          name: "hello",
          text: "function hello",
          tags: ["test"],
          confidence: 0.9,
          createdAt: Date.now(),
        },
      ]

      await storage.saveSignals(signals)
      const loaded = await storage.loadSignals()

      expect(loaded.length).toBe(1)
      expect(loaded[0].name).toBe("hello")
    })

    it("loads empty array when no signals exist", async () => {
      const loaded = await storage.loadSignals()
      expect(loaded).toEqual([])
    })

    it("overwrites signals on save", async () => {
      const signals1: Signal[] = [
        {
          id: "sig-1",
          evidenceId: "ev-1",
          sessionId: "session-1",
          kind: "function",
          name: "func1",
          text: "func1",
          tags: [],
          confidence: 0.9,
          createdAt: Date.now(),
        },
      ]

      await storage.saveSignals(signals1)

      const signals2: Signal[] = [
        {
          id: "sig-2",
          evidenceId: "ev-2",
          sessionId: "session-1",
          kind: "function",
          name: "func2",
          text: "func2",
          tags: [],
          confidence: 0.9,
          createdAt: Date.now(),
        },
      ]

      await storage.saveSignals(signals2)
      const loaded = await storage.loadSignals()

      expect(loaded.length).toBe(1)
      expect(loaded[0].name).toBe("func2")
    })
  })

  describe("addSignals", () => {
    it("adds new signals without duplicates", async () => {
      const signal1: Signal = {
        id: "sig-1",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "hello",
        text: "function hello",
        lineStart: 1,
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const signal2: Signal = {
        id: "sig-2",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "world",
        text: "function world",
        lineStart: 2,
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      await storage.addSignals([signal1])
      const merged = await storage.addSignals([signal2])

      expect(merged.length).toBe(2)
      expect(merged.some((s) => s.name === "hello")).toBe(true)
      expect(merged.some((s) => s.name === "world")).toBe(true)
    })

    it("deduplicates signals with same key", async () => {
      const signal1: Signal = {
        id: "sig-1",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "hello",
        text: "function hello",
        lineStart: 1,
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const signal2: Signal = {
        id: "sig-2",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "hello",
        text: "function hello",
        lineStart: 1,
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const merged = await storage.addSignals([signal1, signal2])

      expect(merged.length).toBe(1)
    })

    it("handles empty initial state", async () => {
      const signal: Signal = {
        id: "sig-1",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "class",
        name: "PhotoModel",
        text: "class PhotoModel",
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const merged = await storage.addSignals([signal])

      expect(merged.length).toBe(1)
      expect(merged[0].name).toBe("PhotoModel")
    })
  })

  describe("saveEvidence / loadEvidence", () => {
    it("saves and loads evidence", async () => {
      const evidence: Evidence = {
        id: "ev-1",
        sessionId: "session-1",
        tool: "read",
        input: { file: "test.ts" },
        output: "file content",
        createdAt: Date.now(),
      }

      await storage.saveEvidence(evidence)
      const loaded = await storage.loadEvidence()

      expect(loaded.length).toBe(1)
      expect(loaded[0].id).toBe("ev-1")
    })

    it("appends evidence, doesn't overwrite", async () => {
      const evidence1: Evidence = {
        id: "ev-1",
        sessionId: "session-1",
        tool: "read",
        input: {},
        output: "content 1",
        createdAt: Date.now(),
      }

      const evidence2: Evidence = {
        id: "ev-2",
        sessionId: "session-1",
        tool: "grep",
        input: {},
        output: "content 2",
        createdAt: Date.now(),
      }

      await storage.saveEvidence(evidence1)
      await storage.saveEvidence(evidence2)
      const loaded = await storage.loadEvidence()

      expect(loaded.length).toBe(2)
    })
  })

  describe("getStats", () => {
    it("returns accurate statistics", async () => {
      const signal1: Signal = {
        id: "sig-1",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "func1",
        text: "func1",
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const signal2: Signal = {
        id: "sig-2",
        evidenceId: "ev-2",
        sessionId: "session-1",
        kind: "class",
        name: "Class1",
        text: "class1",
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const evidence1: Evidence = {
        id: "ev-1",
        sessionId: "session-1",
        tool: "read",
        input: {},
        output: "content 1",
        createdAt: Date.now(),
      }

      const evidence2: Evidence = {
        id: "ev-2",
        sessionId: "session-1",
        tool: "read",
        input: {},
        output: "content 2",
        createdAt: Date.now(),
      }

      await storage.addSignals([signal1, signal2])
      await storage.saveEvidence(evidence1)
      await storage.saveEvidence(evidence2)

      const stats = await storage.getStats()

      expect(stats.evidenceCount).toBe(2)
      expect(stats.signalCount).toBe(2)
      expect(stats.storageUsed).toBeGreaterThan(0)
    })

    it("returns zeros for empty storage", async () => {
      const stats = await storage.getStats()

      expect(stats.evidenceCount).toBe(0)
      expect(stats.signalCount).toBe(0)
      expect(stats.storageUsed).toBe(0)
    })
  })

  describe("clear", () => {
    it("clears all signals and evidence", async () => {
      const signal: Signal = {
        id: "sig-1",
        evidenceId: "ev-1",
        sessionId: "session-1",
        kind: "function",
        name: "hello",
        text: "func",
        tags: [],
        confidence: 0.9,
        createdAt: Date.now(),
      }

      const evidence: Evidence = {
        id: "ev-1",
        sessionId: "session-1",
        tool: "read",
        input: {},
        output: "content",
        createdAt: Date.now(),
      }

      await storage.addSignals([signal])
      await storage.saveEvidence(evidence)

      await storage.clear()

      const stats = await storage.getStats()
      expect(stats.evidenceCount).toBe(0)
      expect(stats.signalCount).toBe(0)
    })
  })
})