# Benchmarks Directory

This directory contains the evaluation benchmark infrastructure for Context Signals MCP.

## Overview

The benchmark system validates that Context Signals MCP actually:
- Reduces storage (signals < raw source)
- Reduces query-time context
- Maintains accuracy
- Achieves favorable break-even

## Directory Structure

```
benchmarks/
├── fixtures/              # Test repositories
│   ├── express-app/      # Express.js fixture (15 files)
│   ├── fastify-app/      # Fastify.js fixture (15 files)
│   └── nextjs-app/       # Next.js App Router fixture (15 files)
├── ground-truth/          # Ground truth query definitions
│   ├── express-app.json  # 15 queries for Express
│   ├── fastify-app.json  # 15 queries for Fastify
│   └── nextjs-app.json   # 15 queries for Next.js
├── baseline/             # Baseline measurements (without MCP)
├── context-signals/     # Context Signals measurements
├── results/             # Aggregated benchmark results
├── reports/             # Generated markdown reports
└── logs/               # Raw log files
```

## Quick Start

### Run Benchmark via CLI

```bash
# Run benchmark on Express fixture
npm run start --tool signals_benchmark --fixture express-app

# Run benchmark on Fastify fixture
npm run start --tool signals_benchmark --fixture fastify-app

# Run benchmark on Next.js fixture
npm run start --tool signals_benchmark --fixture nextjs-app
```

### Run Benchmark via Node

```javascript
import { runBenchmarkSuite } from './dist/benchmark/benchmark-suite.js'

const result = await runBenchmarkSuite({
  fixtureName: 'express-app',
  fixturePath: './benchmarks/fixtures/express-app',
  outputDir: './benchmarks/results'
})

console.log(result.passed ? 'PASSED' : 'FAILED')
console.log(`Storage reduction: ${result.metrics.storage.reductionPercent}%`)
console.log(`Query context reduction: ${result.metrics.queryContext.reductionPercent}%`)
console.log(`Break-even: ${result.metrics.breakEven.breakEvenQueries} queries`)
```

## Fixtures

### Express.js Fixture

Real Express.js application with:
- Routes: users, auth, upload, health
- Services: UserService, AuthService, UploadService
- Middleware: auth, validation, error handling, CORS
- 15 files, ~12,800 chars

### Fastify.js Fixture

Real Fastify.js application with:
- Routes with Fastify plugin system
- Services: UserService, AuthService, UploadService
- Plugins: auth plugin with preHandler
- Schemas: JSON schema validation
- 15 files, ~12,000 chars

### Next.js App Router Fixture

Real Next.js 14 App Router application with:
- API Routes: users, auth, upload
- Services: UserService, AuthService, UploadService
- Components: UserList, UploadForm, Navbar
- 15 files, ~14,000 chars

## Ground Truth Format

Each fixture has a ground truth file defining 15 test queries:

```json
{
  "fixture": "express-app",
  "version": "1.0.0",
  "totalFiles": 15,
  "totalSourceChars": 12805,
  "queries": [
    {
      "id": "express-001",
      "query": "Where is the main app initialized?",
      "category": "navigation",
      "expected": {
        "kind": "function",
        "file": "src/app.ts",
        "handler": "createApp",
        "lineRequired": true
      },
      "difficulty": "easy"
    }
  ]
}
```

### Query Categories

- **navigation** - Finding main app, imports, middleware
- **route_discovery** - Finding API routes, endpoints
- **handler_lookup** - Finding handlers, services, controllers
- **implementation_lookup** - Finding specific logic, validation
- **dependency_lookup** - Finding imports, dependencies

## Metrics

### A. Storage Efficiency

```
storageReduction = (rawSourceChars - signalChars) / rawSourceChars * 100
```

**Success:** signals < raw source

### B. Query Context Reduction

```
queryReduction = (baselineQueryChars - signalQueryChars) / baselineQueryChars * 100
```

**Success:** >= 20% reduction

### C. Full File Reads Reduction

```
fullReadReduction = (baselineFullReads - signalFullReads) / baselineFullReads * 100
```

**Success:** > 0% reduction

### D. Tool Calls Reduction

```
toolCallReduction = (baselineCalls - signalCalls) / baselineCalls * 100
```

**Success:** > 0% reduction

### E. Accuracy

Score each query: 0=wrong, 1=partial, 2=mostly correct, 3=complete

**Success:** Signals score >= baseline score - 0.3

### F. Retrieval Quality (Top-3 Hit Rate)

```
top3HitRate = queriesWithCorrectTop3 / totalQueries * 100
```

**Success:** >= 70% hit rate

### G. Break-Even Analysis

```
breakEvenQueries = indexingCost / averageQuerySavings
```

**Success:** < 50 queries

## Decision Rules

A benchmark is considered successful only if ALL metrics pass:

1. `signalChars < rawSourceChars`
2. `query context reduced by >= 20%`
3. `full-file reads reduced`
4. `tool calls reduced`
5. `accuracy same or better (within 0.3)`
6. `top-3 hit rate >= 70%`
7. `break-even < 50 queries`

## Example Results

### Express.js Benchmark (PASSED 7/7)

| Metric | Baseline | Context Signals | Result |
|--------|----------|----------------|--------|
| Storage Reduction | N/A | 85% | PASS |
| Query Context | 3,792 chars | 884 chars | 77% reduction |
| Full File Reads | 70 | 15 | 79% reduction |
| Tool Calls | 135 | 15 | 89% reduction |
| Accuracy | 2.28/3 | 2.04/3 | PASS |
| Top-3 Hit Rate | N/A | 93.3% | PASS |
| Break-Even | N/A | 5 queries | PASS |

### Fastify.js Benchmark (PASSED 7/7)

| Metric | Baseline | Context Signals | Result |
|--------|----------|----------------|--------|
| Storage Reduction | N/A | 85% | PASS |
| Query Context | 3,847 chars | 893 chars | 77% reduction |
| Full File Reads | 56 | 14 | 75% reduction |
| Tool Calls | 120 | 14 | 88% reduction |
| Accuracy | 2.19/3 | 2.03/3 | PASS |
| Top-3 Hit Rate | N/A | 100% | PASS |
| Break-Even | N/A | 5 queries | PASS |

### Next.js App Router Benchmark (PASSED 7/7)

| Metric | Baseline | Context Signals | Result |
|--------|----------|----------------|--------|
| Storage Reduction | N/A | 85% | PASS |
| Query Context | 3,968 chars | 873 chars | 78% reduction |
| Full File Reads | 60 | 18 | 70% reduction |
| Tool Calls | 135 | 18 | 86% reduction |
| Accuracy | 2.21/3 | 2.16/3 | PASS |
| Top-3 Hit Rate | N/A | 73.3% | PASS |
| Break-Even | N/A | 4 queries | PASS |

## Adding a New Fixture

1. Create fixture directory in `fixtures/`
2. Add source files (15-50 recommended)
3. Create ground truth in `ground-truth/<name>.json`
4. Run benchmark:
   ```bash
   npm run start --tool signals_benchmark --fixture <name>
   ```

## Files

- `src/benchmark/benchmark-suite.ts` - Main benchmark orchestrator
- `src/benchmark/baseline-runner.ts` - Baseline measurement
- `src/benchmark/signals-runner.ts` - Context Signals measurement
- `src/benchmark/indexing-runner.ts` - Indexing metrics
- `src/benchmark/metrics-calculator.ts` - All 7 metrics
- `src/benchmark/report-generator.ts` - Markdown report generation
- `tests/benchmark/metrics.test.ts` - Unit tests for metrics

## Testing

```bash
# Run all benchmark tests
npm test -- tests/benchmark

# Run full benchmark suite
npm test -- --run

# Run with coverage
npm test -- --coverage
```

## CLI Tools

The MCP server supports `signals_benchmark` tool:

```json
{
  "name": "signals_benchmark",
  "inputSchema": {
    "type": "object",
    "properties": {
      "fixture": {
        "type": "string",
        "description": "Fixture name (express-app, fastify-app, nextjs-app)"
      },
      "fixturePath": {
        "type": "string",
        "description": "Path to fixture directory"
      },
      "outputDir": {
        "type": "string",
        "description": "Directory to save results"
      }
    }
  }
}
```

---

*For detailed methodology, see EVAL_BENCHMARK.md and EVAL_BENCHMARK_IMPLEMENTATION.md*
