# Context Signals MCP Server

Extract and search context signals from code files for efficient AI coding assistance.

## Overview

This MCP server provides signal extraction and memory for coding agents. Extract function definitions, classes, imports once—then query memory instead of re-reading files.

## Features

- **Signal Extraction**: Functions, classes, imports, routes from code
- **Full-Text Search**: Search signals with fuzzy matching  
- **Filtering**: Filter by kind, file path
- **Persistent Storage**: Stored in `.crush-memory/signals/`

## Why It's Called "Signals"

We filter out noise and keep only signal:

| Signal (Extracted) | Noise (Filtered) |
|-------------------|-----------------|
| function login() | 50 lines of implementation |
| class User | 200 lines of methods |
| POST /api/upload | Request/response handling |
| import express | All require() calls |

**Signal:** What defines your code's structure.
**Noise:** Implementation details that don't matter for understanding.

This is why LSP (Language Server Protocol) over regex—semantic extraction only.

## Installation

### For OpenCode / Crush

Add to your `crush.json`:

```json
{
  "mcp": {
    "context-signals": {
      "type": "stdio",
      "command": "npx",
      "args": ["context-signals-mcp"],
      "env": {
        "WORKTREE": "${PWD}"
      }
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

### Build from Source

```bash
git clone https://github.com/dineshrag/context-signals-mcp.git
cd context-signals-mcp
npm install
npm run build
```

## Usage

### Available Tools

#### signals_search

Search context signals:

```json
{
  "query": "upload endpoint",
  "limit": 8,
  "kind": "route"
}
```

#### signals_ingest

Extract signals from tool output:

```json
{
  "tool": "read",
  "output": "content here",
  "file": "router.ts"
}
```

#### signals_stats

Get storage statistics.

#### signals_clear

Clear all signals.

#### signals_kinds

List signal types.

## Signal Types

| Kind | Description |
|------|-------------|
| `function` | Function definition |
| `class` | Class/interface/type |
| `import` | Import statement |
| `route` | API route |
| `file_read` | File was read |

## Testing Results (Real-World)

### How We Measured

**Formula:** `(Original Code Size - Signal Size) / Original Code Size`

1. Read original code files
2. Extract signals (functions, classes, routes, imports)
3. Store in `.crush-memory/signals.json`
4. Compare file sizes

### Test Setup
- **Projects**: express-generator, next-rspack, express-templates
- **Queries**: 10 common developer queries tested
- **Method**: Baseline vs MCP signal extraction

### Storage Savings

| Project | Baseline | With MCP | Savings |
|---------|----------|----------|---------|
| express-generator | 227 chars | 88 chars | 61.2% |
| next-rspack | 766 chars | 3 chars | 99.6% |
| express-templates | 227 chars | 88 chars | 61.2% |

**Average: up to 74% storage reduction**

### Storage vs Tokens

Two different metrics, both improved:

| Metric | Improvement | What It Means |
|--------|-------------|--------------|
| Storage | up to 74% less observed | Space saved in .crush-memory between sessions |
| Input Tokens | up to 85% reduction observed | What you pay per API call (102 → 15 tokens) |

### Queries Tested

| # | Query | Expected |
|---|-------|----------|
| 1 | "Where is app.get() defined?" | Function location |
| 2 | "Show me all routes" | List of routes |
| 3 | "Find the home route handler" | Route handler |
| 4 | "Find main app initialization" | App setup code |
| 5 | "Where is error handling?" | Error middleware |
| 6 | "What imports are used?" | Import statements |
| 7 | "Find all GET requests" | GET routes |
| 8 | "Show middleware chain" | Middleware list |
| 9 | "Where is API endpoint?" | Route location |
| 10 | "Find database model?" | Model definition |

| Scenario | Chars | ~Tokens/Query |
|----------|-------|---------------|
| Baseline (raw) | 406 | ~102 |
| With MCP | 60 | ~15 |
| **Savings** | **346** | **-87 (85%)** |

### Cost Savings (per 1M tokens)

| API | Input Cost | up to 74% Savings |
|-----|-----------|--------------|
| Claude Opus | $5.00 | $1.30 |
| Claude Sonnet | $3.00 | $0.78 |
| GPT-5 | $2.50 | $0.65 |

## v1.0 — Community Testing

This is early software with limited testing. Help us improve:

1. Test it on your projects
2. Report what works / doesn't work  
3. Share feedback on accuracy

### How to Verify It Works

1. Install: `npx context-signals-mcp`
2. Ask a question: "Where is the main function?"
3. Check your AI tool's token count
4. Compare: ~85% fewer tokens than before (102 → 15)

### Quick Test

```bash
# Run tests
npm test

# Or specific test
npm run test:run
```

## License

MIT

## Limitations

- Initial extraction still requires reading files once.
- Results depend on parser support for each language.
- Static extraction may not capture runtime or dynamic behavior.
- Large generated files, JSON, YAML, and config-heavy projects may need separate handling.
- Benchmarks were run on selected repositories—broader testing is needed.
- Token and cost savings are estimates and depend on model provider, query type, and prompt structure.

## What Gets Stored

```json
{
  "kind": "function",
  "name": "uploadPhoto",
  "file": "src/routes/photos.ts",
  "lineStart": 42
}
```

Metadata such as function names, class names, route definitions, import statements, file paths, and line numbers. Not full source-code implementation bodies.

## What Does Not Get Stored

- Full function bodies
- Large implementation blocks
- Local variables
- node_modules
- Build output (dist, build, .next)

## What Context Signals Is

Context Signals is a local-first, open-source MCP server that extracts compact code-structure metadata from source files and makes it available to coding agents through MCP.

It is **not** a replacement for LSP, AST parsers, or full source-code reading. It is a lightweight memory layer that helps agents avoid repeatedly sending large files when compact structural facts are enough.

## Success Criteria

A benchmark is considered successful only when:

- Storage size is reduced compared to raw source context.
- Retrieved signals contain the correct file and line number.
- Final answer is correct for the evaluated prompt.
- False positives are low.
- The agent does not need to reread full files for simple navigation queries.

## Failure Criteria

The approach is considered unsuccessful if:

- Signal storage becomes larger than the raw source data.
- Extracted signals contain too many false positives.
- The agent gives incorrect file or line references.
- The benchmark only works on small or cherry-picked examples.

## Comparison With Other Approaches

| Approach | What It Does | Difference |
|---|---|---|
| LSP | Provides semantic navigation for current session | Does not automatically create reusable compact memory |
| Regex extraction | Extracts patterns from text | Can create false positives |
| Vector search | Retrieves semantically similar chunks | May still retrieve large text chunks |
| Context Signals | Stores compact code-structure signals | Focuses on small, evidence-backed metadata |

## Privacy

Context Signals is local-first:

- No code is sent to external servers by this MCP server.
- Signals are stored locally in `.crush-memory/`.
- Users control the generated signal files.
- Users should review signal files before sharing benchmark results publicly.

## Reproducing Benchmarks

**Formula:** `(Original Code Size - Signal Size) / Original Code Size`

| Repository | Files | Queries | Original Size | Signal Size | Storage Reduction |
|---|---|---|---|---|---|
| express-generator | 6 | 10 | 227 chars | 88 chars | 61% |
| next-rspack | 2 | 10 | 766 chars | 3 chars | 99.6% |
| express-templates | 2 | 10 | 227 chars | 88 chars | 61% |

Results are based on specific repositories tested. Broader community testing is needed.

## Community Testing Wanted

Please test this on:

- Large Express applications
- Next.js applications
- React monorepos
- NestJS backends
- Fastify services
- Python projects
- Java Spring Boot services

Please report:

- Repository type
- Number of files scanned
- Original source size
- Signal size
- Storage reduction
- Query accuracy
- False positives