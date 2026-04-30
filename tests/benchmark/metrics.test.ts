import { describe, it, expect, beforeEach } from "vitest"
import { calculateFullMetrics, type FullMetrics } from "../../src/benchmark/metrics-calculator.js"
import type { BaselineResult } from "../../src/benchmark/baseline-runner.js"
import type { SignalsResult } from "../../src/benchmark/signals-runner.js"
import type { IndexingResult } from "../../src/benchmark/indexing-runner.js"

function createMockBaseline(totals: Partial<{ totalToolCalls: number; totalFullReads: number; totalTokens: number; avgTokensPerQuery: number; avgCorrectness: number }> = {}): BaselineResult {
  return {
    fixture: "test-fixture",
    timestamp: Date.now(),
    rawSourceChars: 50000,
    fileCount: 50,
    queries: [
      {
        queryId: "test-001",
        query: "Test query 1",
        category: "navigation",
        difficulty: "easy",
        simulatedToolCalls: 8,
        simulatedFullReads: 4,
        simulatedTokens: 3500,
        simulatedCorrectness: 2.0,
        simulatedTimeMs: 4000,
      },
      {
        queryId: "test-002",
        query: "Test query 2",
        category: "route_discovery",
        difficulty: "medium",
        simulatedToolCalls: 10,
        simulatedFullReads: 5,
        simulatedTokens: 4000,
        simulatedCorrectness: 2.5,
        simulatedTimeMs: 5000,
      },
    ],
    totals: {
      totalToolCalls: totals.totalToolCalls ?? 18,
      totalFullReads: totals.totalFullReads ?? 9,
      totalTokens: totals.totalTokens ?? 7500,
      avgTokensPerQuery: totals.avgTokensPerQuery ?? 3750,
      avgCorrectness: totals.avgCorrectness ?? 2.25,
    },
  }
}

function createMockSignals(totals: Partial<{ totalSearchCalls: number; totalFullReads: number; avgTokensPerQuery: number; avgCorrectness: number; top3HitRate: number }> = {}): SignalsResult {
  return {
    fixture: "test-fixture",
    timestamp: Date.now(),
    signalChars: 8000,
    signalCount: 150,
    queries: [
      {
        queryId: "test-001",
        query: "Test query 1",
        category: "navigation",
        difficulty: "easy",
        searchCalls: 1,
        signalCharsReturned: 400,
        targetedReads: 1,
        fullFileReads: 1,
        simulatedTokens: 600,
        simulatedCorrectness: 2.0,
        simulatedTimeMs: 1000,
        top3Hit: true,
      },
      {
        queryId: "test-002",
        query: "Test query 2",
        category: "route_discovery",
        difficulty: "medium",
        searchCalls: 2,
        signalCharsReturned: 500,
        targetedReads: 2,
        fullFileReads: 1,
        simulatedTokens: 800,
        simulatedCorrectness: 2.2,
        simulatedTimeMs: 1200,
        top3Hit: true,
      },
    ],
    totals: {
      totalSearchCalls: totals.totalSearchCalls ?? 3,
      totalSignalChars: 900,
      totalTargetedReads: 3,
      totalFullReads: totals.totalFullReads ?? 2,
      totalTokens: totals.totalTokens ?? 1400,
      avgTokensPerQuery: totals.avgTokensPerQuery ?? 700,
      avgCorrectness: totals.avgCorrectness ?? 2.1,
      top3HitRate: totals.top3HitRate ?? 100,
    },
  }
}

function createMockIndexing(totals: Partial<{ rawSourceChars: number; signalChars: number; filesScanned: number }> = {}): IndexingResult {
  return {
    fixture: "test-fixture",
    timestamp: Date.now(),
    filesScanned: totals.filesScanned ?? 50,
    filesSkipped: 0,
    rawSourceChars: totals.rawSourceChars ?? 50000,
    signalChars: totals.signalChars ?? 8000,
    storageReductionPercent: 84,
    scanDurationMs: 1200,
    signalsByKind: {
      function: 80,
      class: 20,
      route: 30,
      import: 40,
      middleware: 10,
    },
    signalsByLanguage: {
      typescript: 180,
      javascript: 0,
    },
    lspAvailable: false,
    byKind: {
      function: 80,
      class: 20,
      route: 30,
      import: 40,
      middleware: 10,
    },
    byLanguage: {
      typescript: 180,
      javascript: 0,
    },
    byFramework: {
      express: 30,
    },
  }
}

describe("Metrics Calculator", () => {
  describe("Storage Efficiency", () => {
    it("should calculate storage reduction correctly", () => {
      const baseline = createMockBaseline()
      const signals = createMockSignals()
      const indexing = createMockIndexing({ rawSourceChars: 50000, signalChars: 8000 })

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.storage.reductionPercent).toBe(84)
      expect(metrics.storage.success).toBe(true)
      expect(metrics.storage.rawSourceChars).toBe(50000)
      expect(metrics.storage.signalChars).toBe(8000)
    })

    it("should fail storage if signals are larger", () => {
      const baseline = createMockBaseline()
      const signals = createMockSignals()
      const indexing = createMockIndexing({ rawSourceChars: 10000, signalChars: 12000 })

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.storage.reductionPercent).toBe(-20)
      expect(metrics.storage.success).toBe(false)
    })
  })

  describe("Query Context Reduction", () => {
    it("should calculate query context reduction correctly", () => {
      const baseline = createMockBaseline({ avgTokensPerQuery: 3750 })
      const signals = createMockSignals({ avgTokensPerQuery: 700 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.queryContext.reductionPercent).toBe(81)
      expect(metrics.queryContext.success).toBe(true)
    })

    it("should fail query context reduction if less than 20%", () => {
      const baseline = createMockBaseline({ avgTokensPerQuery: 1000 })
      const signals = createMockSignals({ avgTokensPerQuery: 850 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.queryContext.reductionPercent).toBe(15)
      expect(metrics.queryContext.success).toBe(false)
    })
  })

  describe("Full File Reads", () => {
    it("should calculate full file read reduction correctly", () => {
      const baseline = createMockBaseline({ totalFullReads: 20 })
      const signals = createMockSignals({ totalFullReads: 5 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.fullFileReads.reductionPercent).toBeGreaterThanOrEqual(70)
      expect(metrics.fullFileReads.success).toBe(true)
    })
  })

  describe("Tool Calls", () => {
    it("should calculate tool call reduction correctly", () => {
      const baseline = createMockBaseline({ totalToolCalls: 20 })
      const signals = createMockSignals({ totalSearchCalls: 3 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.toolCalls.reductionPercent).toBeGreaterThanOrEqual(80)
      expect(metrics.toolCalls.success).toBe(true)
    })
  })

  describe("Accuracy", () => {
    it("should pass accuracy if signals are not significantly worse", () => {
      const baseline = createMockBaseline({ avgCorrectness: 2.5 })
      const signals = createMockSignals({ avgCorrectness: 2.3 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.accuracy.success).toBe(true)
    })

    it("should fail accuracy if signals are much worse", () => {
      const baseline = createMockBaseline({ avgCorrectness: 2.5 })
      const signals = createMockSignals({ avgCorrectness: 1.5 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.accuracy.success).toBe(false)
    })
  })

  describe("Retrieval Quality", () => {
    it("should pass retrieval if top-3 hit rate >= 70%", () => {
      const baseline = createMockBaseline()
      const signals = createMockSignals({ top3HitRate: 85 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.retrieval.top3HitRate).toBe(85)
      expect(metrics.retrieval.success).toBe(true)
    })

    it("should fail retrieval if top-3 hit rate < 70%", () => {
      const baseline = createMockBaseline()
      const signals = createMockSignals({ top3HitRate: 50 })
      const indexing = createMockIndexing()

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.retrieval.top3HitRate).toBe(50)
      expect(metrics.retrieval.success).toBe(false)
    })
  })

  describe("Break-Even", () => {
    it("should calculate break-even queries correctly", () => {
      const baseline = createMockBaseline({ avgTokensPerQuery: 3750 })
      const signals = createMockSignals({ avgTokensPerQuery: 700 })
      const indexing = createMockIndexing({ rawSourceChars: 50000 })

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.breakEven.breakEvenQueries).toBeGreaterThan(10)
      expect(metrics.breakEven.breakEvenQueries).toBeLessThan(25)
      expect(metrics.breakEven.success).toBe(true)
    })

    it("should fail break-even if queries needed > 50", () => {
      const baseline = createMockBaseline({ avgTokensPerQuery: 1000 })
      const signals = createMockSignals({ avgTokensPerQuery: 900 })
      const indexing = createMockIndexing({ rawSourceChars: 50000 })

      const metrics = calculateFullMetrics(baseline, signals, indexing)

      expect(metrics.breakEven.breakEvenQueries).toBe(500)
      expect(metrics.breakEven.success).toBe(false)
    })
  })
})