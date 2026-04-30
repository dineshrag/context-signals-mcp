import type { BenchmarkQuery } from "../types/benchmark.js"

export const DEFAULT_QUERIES: BenchmarkQuery[] = [
  {
    query: "Where is the main app initialized?",
    expected: { kind: "function" },
  },
  {
    query: "Show all routes in this project",
    expected: { kind: "route" },
  },
  {
    query: "Where is the login handler?",
    expected: { kind: "function" },
  },
  {
    query: "Find the upload route",
    expected: { kind: "route" },
  },
  {
    query: "Find POST /upload",
    expected: { kind: "route", method: "POST" },
  },
  {
    query: "Show middleware chain",
    expected: { kind: "middleware" },
  },
  {
    query: "Where is error handling defined?",
    expected: { kind: "function" },
  },
  {
    query: "What imports are used in the main app file?",
    expected: { kind: "import" },
  },
  {
    query: "Where is the API endpoint defined?",
    expected: { kind: "route" },
  },
  {
    query: "Find the main service/model/controller definition",
    expected: { kind: "class" },
  },
]

export const NAVIGATION_QUERIES: BenchmarkQuery[] = [
  {
    query: "Where is upload handled?",
    expected: { kind: "route", fileContains: "upload" },
  },
  {
    query: "Find database model",
    expected: { kind: "class", fileContains: "model" },
  },
  {
    query: "Show authentication middleware",
    expected: { kind: "middleware" },
  },
  {
    query: "Find POST endpoint",
    expected: { kind: "route", method: "POST" },
  },
  {
    query: "Where is the router defined?",
    expected: { kind: "route" },
  },
]