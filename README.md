# Context Signals MCP

Experimental local-first MCP server for pre-indexed code navigation.

Context Signals extracts compact structural metadata from your codebase—functions, routes, classes, imports, files, and line numbers—then exposes that metadata to coding agents through MCP.

It is designed to reduce repeated full-file reads for navigation and discovery queries.

It is not a replacement for reading source code. For implementation-level reasoning, signals should be used as a locator before reading targeted source code.

> **Status:** Experimental v1.0
> **Best for:** warm-cache navigation/discovery queries
> **Not ideal for:** cold start, small projects, one-off queries, implementation reasoning

## Real-World Testing Summary

| Scenario | Result | Interpretation |
|---|---:|---|
| PhotoVerify cached navigation | 80.2% reduction | Strong warm-cache benefit |
| PhotoVerify cached route query | 39.9% reduction | Moderate benefit |
| PhotoVerify cold search | ~10x worse | Cold start penalty |
| Todo API, 5 simple queries | 65.6% worse | Small project overhead |

## How It Works

```
Initial run:
  Source files → Scanner → Extractor → Local signal store

Later navigation query:
  User query → Signal search → File/route/function metadata → Optional targeted source read
```

**Important:** Signals are a map, not the territory. Source code remains the ground truth.

## Quick Start

### Setup

```bash
npm install
npm run build
```

### For OpenCode

Add to `crush.json`:

```json
{
  "mcp": {
    "context-signals": {
      "type": "stdio",
      "command": "npx",
      "args": ["context-signals-mcp"],
      "env": { "WORKTREE": "${PWD}" }
    }
  }
}
```

### For Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "context-signals": {
      "command": "npx",
      "args": ["context-signals-mcp"]
    }
  }
}
```

## Recommended Workflow

1. Index the project first.
2. Use signal search for navigation/discovery queries.
3. Use the returned file and line metadata to decide whether source reading is needed.
4. For implementation questions, read the targeted source range.
5. Re-index changed files as the project evolves.

## Avoid

- Searching signals before indexing.
- Using it for one-off questions on tiny projects.
- Expecting metadata to answer implementation-level questions.
- Treating file-path-only signals as sufficient.

## When It Works Best

- Signals are pre-indexed before users ask questions.
- The project is medium or large.
- The user asks repeated navigation/discovery questions.
- The codebase is long-lived and evolves over time.
- The agent needs file, symbol, route, handler, or line-number metadata.
- The workflow benefits from a persistent local code-navigation memory.

## When It Does Not Work Well

- Cold start with an empty signal store.
- Small projects where direct file reads are already cheap.
- Single or very few queries where indexing cost cannot be amortized.
- Implementation-level reasoning questions.
- Queries that require full business logic, validation rules, or edge-case analysis.

## Benchmark Results

Validated against Express.js, Fastify.js, and Next.js fixtures:

| Metric | Result |
|--------|--------|
| Storage Reduction | 85% |
| Warm Query Context | 97-99% |
| Top-3 Hit Rate | 80-93% |

**Scope:** Navigation and discovery queries only. Implementation-level reasoning still requires reading source code.

Two metrics published for community validation: break-even (~62 queries) and tool calls reduction (baseline simulation needs improvement).

See [docs/benchmark-findings.html](docs/benchmark-findings.html) for detailed results and methodology.

## Signal Types

| Kind | Description |
|------|-------------|
| `function` | Function definition |
| `class` | Class/interface/type |
| `import` | Import statement |
| `route` | API route |

## Query-Time Token Reduction

This measures query-time context reduction only. Total cost should include the upfront indexing cost. For small projects or few queries, total cost may be worse than baseline.

**Estimated query-time input-token reduction for warm-cache navigation queries.**

## Roadmap

- [ ] Auto-index when signal store is empty
- [ ] Incremental indexing for changed files
- [ ] AST-based JavaScript/TypeScript extraction
- [ ] Framework extractors for Express, Fastify, Next.js
- [ ] Optional LSP enrichment
- [ ] Query intent detection
- [ ] Targeted file/range reads
- [ ] Cold vs warm benchmark separation
- [ ] Larger repo benchmark suite
- [ ] Better baseline modeling from real agent traces

## Limitations

- Cold start can be worse than baseline if signals are not pre-indexed.
- Small projects may not benefit because direct reads are already cheap.
- Single-query usage may not amortize indexing cost.
- File-path-only signals are insufficient for route/function discovery.
- Implementation-level reasoning still requires reading source code.
- Results vary by codebase structure and query type.

## Privacy

- No code sent to external servers
- Signals stored locally in `.crush-memory/`
- Users control generated signal files

## License

MIT