# Context Signals MCP

Extract and search context signals from code files. Helps AI coding assistants navigate codebases more efficiently.

## What It Does

Context Signals extracts compact metadata from code—function names, file locations, route definitions—once at session start. Agents query signals instead of reading full files.

**Result:** 97-99% less context per navigation query.

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

## Usage

1. **At session start**: Call `signals_scan` to index the workspace
2. **Before reading files**: Call `signals_search` to check indexed signals
3. **After reading files**: Call `signals_ingest` to add new signals

### Example

```json
// Search for upload endpoint
{
  "query": "upload endpoint",
  "limit": 10,
  "kind": "route"
}
```

## Cost Savings

Reduces input tokens for navigation queries by returning metadata instead of full source files.

| Provider | Input Price | Savings per 1M Queries |
|----------|-------------|----------------------|
| OpenAI (GPT-4o) | $5.00 / 1M | ~$4.90 |
| Claude (Sonnet) | $3.00 / 1M | ~$2.94 |
| Gemini (Flash) | $0.35 / 1M | ~$0.34 |

**Note:** Actual savings depend on query type, model, and usage patterns. Signal queries return structural metadata only—not implementation details.

## Benchmark Results

Validated against Express.js, Fastify.js, and Next.js fixtures:

| Metric | Result |
|--------|--------|
| Storage Reduction | 85% |
| Query Context Reduction | 97-99% |
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

## Limitations

- Benefits apply to navigation and discovery queries
- Implementation-level reasoning still requires reading source
- Results vary by codebase structure and query type

## Privacy

- No code sent to external servers
- Signals stored locally in `.crush-memory/`
- Users control generated signal files

## License

MIT
