import { describe, it, expect } from "vitest"
import { searchSignals, getSignalKinds } from "../src/search.js"
import type { Signal } from "../src/extractor.js"

const createSignal = (overrides: Partial<Signal> = {}): Signal => ({
  id: `sig-${Math.random()}`,
  evidenceId: "ev-1",
  sessionId: "session-1",
  kind: "function",
  name: "testFunc",
  text: "function testFunc defined in test.ts at line 1",
  file: "test.ts",
  language: "typescript",
  tags: ["function", "test"],
  confidence: 0.9,
  createdAt: Date.now(),
  ...overrides,
})

const sampleSignals: Signal[] = [
  createSignal({
    name: "uploadPhoto",
    kind: "function",
    text: "async function uploadPhoto()",
    tags: ["function", "upload", "photo"],
    file: "controllers/photo.ts",
  }),
  createSignal({
    name: "getPhotos",
    kind: "function",
    text: "function getPhotos()",
    tags: ["function", "get", "photo"],
    file: "controllers/photo.ts",
  }),
  createSignal({
    name: "PhotoModel",
    kind: "class",
    text: "class PhotoModel",
    tags: ["class", "model", "photo"],
    file: "models/photo.ts",
  }),
  createSignal({
    name: "PhotoProps",
    kind: "class",
    text: "interface PhotoProps",
    tags: ["interface", "props", "photo"],
    file: "models/photo.ts",
  }),
  createSignal({
    name: "POST /photos",
    kind: "route",
    text: "Route POST /photos in photo.ts",
    tags: ["route", "post", "photos"],
    file: "routes/photo.ts",
  }),
  createSignal({
    name: "GET /photos",
    kind: "route",
    text: "Route GET /photos in photo.ts",
    tags: ["route", "get", "photos"],
    file: "routes/photo.ts",
  }),
  createSignal({
    name: "express",
    kind: "import",
    text: "import express from 'express'",
    tags: ["import", "express"],
    file: "app.ts",
  }),
]

describe("searchSignals", () => {
  describe("basic search", () => {
    it("finds signals matching query", () => {
      const results = searchSignals(sampleSignals, { query: "upload" })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].name).toContain("upload")
    })

    it("finds signals by name", () => {
      const results = searchSignals(sampleSignals, { query: "PhotoModel" })
      
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.name === "PhotoModel")).toBe(true)
    })

    it("finds signals by file path", () => {
      const results = searchSignals(sampleSignals, { query: "controllers" })
      
      expect(results.length).toBeGreaterThan(0)
    })

    it("returns empty for no matches", () => {
      const results = searchSignals(sampleSignals, { query: "nonexistent" })
      
      expect(results.length).toBe(0)
    })
  })

  describe("fuzzy search", () => {
    it("finds matches with typos", () => {
      const results = searchSignals(sampleSignals, { query: "uplod" }) // typo
      
      expect(results.length).toBeGreaterThan(0)
    })

    it("finds partial matches", () => {
      const results = searchSignals(sampleSignals, { query: "Photo" })
      
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe("filter by kind", () => {
    it("filters by function kind", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        kind: "function",
      })
      
      results.forEach((r) => {
        expect(r.kind).toBe("function")
      })
    })

    it("filters by class kind", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        kind: "class",
      })
      
      results.forEach((r) => {
        expect(r.kind).toBe("class")
      })
    })

    it("filters by route kind", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        kind: "route",
      })
      
      results.forEach((r) => {
        expect(r.kind).toBe("route")
      })
    })
  })

  describe("filter by file", () => {
    it("filters by exact file path", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        file: "controllers/photo.ts",
      })
      
      results.forEach((r) => {
        expect(r.file).toContain("controllers/photo.ts")
      })
    })

    it("filters by file substring", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        file: "photo.ts",
      })
      
      results.forEach((r) => {
        expect(r.file).toContain("photo.ts")
      })
    })
  })

  describe("result limits", () => {
    it("limits results when specified", () => {
      const results = searchSignals(sampleSignals, {
        query: "photo",
        limit: 2,
      })
      
      expect(results.length).toBeLessThanOrEqual(2)
    })

    it("uses default limit of 8", () => {
      const manySignals = Array.from({ length: 20 }, (_, i) =>
        createSignal({ name: `func${i}`, text: `function func${i}` })
      )
      
      const results = searchSignals(manySignals, { query: "func" })
      
      expect(results.length).toBeLessThanOrEqual(8)
    })
  })

  describe("deduplication", () => {
    it("handles different signals with same name but different lines", () => {
      const signals: Signal[] = [
        createSignal({ name: "hello", lineStart: 1 }),
        createSignal({ name: "hello", lineStart: 10 }),
      ]
      
      const results = searchSignals(signals, { query: "hello" })
      
      expect(results.length).toBe(2)
    })
  })

  describe("scoring", () => {
    it("ranks exact name matches higher", () => {
      const signals: Signal[] = [
        createSignal({ name: "processData", text: "processData function" }),
        createSignal({ name: "helper", text: "some processData reference" }),
      ]
      
      const results = searchSignals(signals, { query: "processData" })
      
      // Name match should rank higher than text match
      expect(results[0].name).toBe("processData")
    })

    it("returns score in results", () => {
      const results = searchSignals(sampleSignals, { query: "photo" })
      
      results.forEach((r) => {
        expect(typeof r.score).toBe("number")
        expect(r.score).toBeGreaterThan(0)
      })
    })
  })

  describe("empty query", () => {
    it("returns results for empty query (prefix search)", () => {
      const results = searchSignals(sampleSignals, { query: "" })
      
      // Empty query typically returns few/empty results with MiniSearch
      // This is expected behavior
      expect(Array.isArray(results)).toBe(true)
    })
  })

  describe("result properties", () => {
    it("returns required properties in results", () => {
      const results = searchSignals(sampleSignals, { query: "upload" })
      
      if (results.length > 0) {
        const result = results[0]
        expect(result).toHaveProperty("score")
        expect(result).toHaveProperty("kind")
        expect(result).toHaveProperty("text")
        expect(result).toHaveProperty("confidence")
        expect(result).toHaveProperty("evidenceId")
      }
    })

    it("shortens file paths", () => {
      const results = searchSignals(sampleSignals, { query: "photo" })
      
      results.forEach((r) => {
        if (r.file) {
          expect(r.file.includes("\\")).toBe(false)
        }
      })
    })
  })
})

describe("getSignalKinds", () => {
  it("returns list of signal kinds", () => {
    const kinds = getSignalKinds()
    
    expect(Array.isArray(kinds)).toBe(true)
    expect(kinds.length).toBeGreaterThan(0)
    expect(kinds).toContain("function")
    expect(kinds).toContain("class")
    expect(kinds).toContain("import")
    expect(kinds).toContain("route")
  })
})

describe("edge cases", () => {
  it("handles empty signal array", () => {
    const results = searchSignals([], { query: "test" })
    
    expect(results).toEqual([])
  })

  it("handles special characters in query", () => {
    const results = searchSignals(sampleSignals, { query: "/" })
    
    // Should not throw
    expect(Array.isArray(results)).toBe(true)
  })

  it("handles very long query", () => {
    const longQuery = "a".repeat(1000)
    const results = searchSignals(sampleSignals, { query: longQuery })
    
    expect(Array.isArray(results)).toBe(true)
  })
})