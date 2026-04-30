import { describe, it, expect } from "vitest"
import { extractSignals, type Evidence } from "../src/extractor.js"

function createEvidence(output: string, tool = "read"): Evidence {
  return {
    id: "test-id",
    evidenceId: "test-evidence",
    sessionId: "test-session",
    tool,
    input: {},
    output,
    createdAt: Date.now(),
  }
}

describe("Regression Tests - Must NOT Extract", () => {
  describe("Function calls that look like definitions", () => {
    it("does not extract HTTPException() as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: throw new HTTPException('Not found')\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "HTTPException")

      expect(functions.length).toBe(0)
    })

    it("does not extract len() as function", () => {
      const evidence = createEvidence(
        "<path>/app.py</path>\n<content>\n1: print(len(items))\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "len")

      expect(functions.length).toBe(0)
    })

    it("does not extract open() as function", () => {
      const evidence = createEvidence(
        "<path>/app.py</path>\n<content>\n1: with open('file.txt') as f:\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "open")

      expect(functions.length).toBe(0)
    })

    it("does not extract PhotoUploadResponse() as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: return new PhotoUploadResponse()\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "PhotoUploadResponse")

      expect(functions.length).toBe(0)
    })

    it("does not extract console.log() as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: console.log('debug info')\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "console")

      expect(functions.length).toBe(0)
    })

    it("does not extract response.json() as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: return response.json({ success: true })\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "response")

      expect(functions.length).toBe(0)
    })

    it("does not extract .map() callback as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: items.map(x => x.id)\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "map")

      expect(functions.length).toBe(0)
    })

    it("does not extract .forEach() as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: items.forEach(console.log)\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "forEach")

      expect(functions.length).toBe(0)
    })
  })

  describe("Built-in/standard library calls", () => {
    it("does not extract parseInt as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: const num = parseInt('42')\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "parseInt")

      expect(functions.length).toBe(0)
    })

    it("does not extract JSON.parse as function", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: const obj = JSON.parse(data)\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "JSON")

      expect(functions.length).toBe(0)
    })

    it("does not extract require() as function", () => {
      const evidence = createEvidence(
        "<path>/app.js</path>\n<content>\n1: const express = require('express')\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "require")

      expect(functions.length).toBe(0)
    })
  })

  describe("Constructor calls", () => {
    it("does not extract new Something() call as function definition", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: const handler = new RequestHandler()\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function" && s.name === "RequestHandler")

      expect(functions.length).toBe(0)
    })
  })
})