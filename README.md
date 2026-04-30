# Context Signals MCP

<h1 style="font-size: 2.5rem; font-weight: 800; margin-bottom: 1rem; color: #111;">
  Reduce Query-Time Context for Navigation Queries by Up to 95%
</h1>

<p style="font-size: 1.125rem; color: #333; margin-bottom: 1.5rem;">
  Context Signals MCP extracts compact structural metadata from your codebase—functions, routes, classes, imports, files, and line numbers—so your coding agent spends less context on navigation and discovery.
</p>

<p style="font-size: 0.9375rem; color: #666; font-style: italic; margin-bottom: 1rem;">
  Signal-first navigation layer for coding agents
</p>

<div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem;">
  <span style="background: #111; color: #fff; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600;">v1.1</span>
  <span style="background: #e8f5e9; color: #2e7d32; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600;">Auto-Index ✓</span>
  <span style="background: #e8f5e9; color: #2e7d32; padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.875rem; font-weight: 600;">Incremental ✓</span>
</div>

## Real Benchmark Results

<div style="background: #fafafa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 1.5rem; margin-bottom: 2rem;">
  <p style="margin-bottom: 1rem; font-size: 0.9375rem; color: #666;">
    Benchmarks on production codebases:
  </p>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
    <div style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 1rem;">
      <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.5rem;">Cal.com TRPC</div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #111;">81%</div>
      <div style="font-size: 0.8125rem; color: #666;">context reduction</div>
      <div style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">426 files • 880K chars</div>
    </div>
    <div style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 1rem;">
      <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.5rem;">Trigger.dev Core</div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #111;">95%</div>
      <div style="font-size: 0.8125rem; color: #666;">context reduction</div>
      <div style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">246 files • 1.3M chars</div>
    </div>
    <div style="background: #fff; border: 1px solid #ddd; border-radius: 6px; padding: 1rem;">
      <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 0.5rem;">PhotoVerify</div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #111;">79%</div>
      <div style="font-size: 0.8125rem; color: #666;">context reduction</div>
      <div style="font-size: 0.75rem; color: #999; margin-top: 0.5rem;">24 files • 39K chars</div>
      <div style="font-size: 0.6875rem; color: #999; margin-top: 0.25rem;">Smaller mixed-language project (variable results)</div>
    </div>
  </div>
</div>

<h2 id="the-problem">The Problem</h2>

<p>
  Coding agents spend a large portion of their context budget just figuring out <strong>where things are</strong> in a codebase.
</p>

<p>For questions like:</p>
<ul>
  <li>Where is the POST /upload endpoint?</li>
  <li>Which file handles authentication?</li>
  <li>What routes exist in this service?</li>
</ul>

<p>Agents typically:</p>
<ol>
  <li>Search for keywords</li>
  <li>Read multiple full files</li>
  <li>Extract relevant sections manually</li>
</ol>

<p>This leads to:</p>
<ul>
  <li>High token usage</li>
  <li>Slow responses</li>
  <li>Repeated reading of the same files across queries</li>
</ul>

<h2 id="why-current-approaches-fall-short">Why Current Approaches Fall Short</h2>

<p>Traditional approaches rely on file-level retrieval:</p>
<ul>
  <li>Keyword search returns entire files</li>
  <li>RAG systems still load large chunks of code</li>
  <li>LSP tools provide structure, but are not optimized for token efficiency</li>
</ul>

<p>Even when the question is simple, the agent often reads far more code than necessary.</p>

<h2 id="why-not-just-use-rag">Why Not Just Use RAG?</h2>

<p>
  RAG retrieves large chunks of code. Context Signals MCP retrieves <strong>structured metadata first</strong>,
  then reads source only when necessary.
</p>
<p>
  This reduces unnecessary context usage by guiding the agent to exact file locations
  before diving into implementation details.
</p>

<h2 id="the-idea">The Idea</h2>

<p>
  Instead of repeatedly reading source files, what if we extract a <strong>reusable map</strong> of the codebase once?
</p>

<p>Context Signals MCP builds a reusable local signal store containing:</p>
<ul>
  <li>Functions</li>
  <li>Classes</li>
  <li>Routes</li>
  <li>Imports</li>
  <li>File paths and line numbers</li>
</ul>

<p>Then, for each query:</p>
<ul>
  <li>The agent searches signals first</li>
  <li>Identifies relevant locations</li>
  <li>Reads source code only when necessary</li>
</ul>

<p>
  <strong>Why this matters:</strong> Context reduction happens because the agent navigates via metadata—file names, function signatures, route patterns—before touching implementation details.
</p>

<p>
  <strong>Important:</strong> Context Signals MCP does not replace reading source code.
  It reduces unnecessary reading by helping agents navigate to the right places first.
</p>

## Example

<p><strong>Query:</strong> "Where is the POST /upload endpoint?"</p>

<p><strong>Baseline:</strong></p>
<ul>
  <li>Reads 3–5 files</li>
  <li>~5K–15K tokens</li>
</ul>

<p><strong>With MCP:</strong></p>
<ul>
  <li>Returns 2–3 route signals</li>
  <li>~500–1K tokens</li>
  <li>Optional targeted source read only when needed</li>
</ul>

<p><strong>Result:</strong> Faster navigation, lower context usage, and fewer unnecessary file reads.</p>

## Why This Matters

Reducing unnecessary context:

- Improves response quality — agents focus on relevant code
- Reduces context window pressure — more room for actual reasoning
- Enables more complex reasoning within token limits

## Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Context Reduction** | 81-95% | Warm-cache navigation queries on large codebases |
| **Top-3 Hit Rate** | 100% | In evaluated benchmark queries only |
| **Signal Lookup Speed** | 5-29x faster | Lookup vs reading files |
| **Break-Even** | ~5-15 queries | Depends on project size |
| **Auto-Index** | On startup | No manual scan needed |

## Scope & Conditions

Results are strongest when:
- Medium to large codebases (50+ files)
- JavaScript/TypeScript projects
- Warm-cache (after indexing)
- Navigation and discovery queries

Results may vary for:
- Small projects (< 50 files)
- Cold start scenarios (initial indexing cost)
- Python (experimental, processed using TS extractors)
- Deep implementation reasoning queries

## When Not to Use

Context Signals MCP is not the right tool when:

- **Small projects** (&lt; 10–20 files) — indexing cost outweighs benefit
- **One-off queries** — no repeated navigation savings
- **Full implementation reasoning** — requires reading source code anyway
- **Cold-cache scenarios** — initial indexing before first query

## Language Support

| Language | Status | Notes |
|----------|--------|-------|
| JavaScript / TypeScript | ✅ Production-ready | Full AST extraction |
| Python | 🟡 Experimental | Processed using generic extractors (native Python AST support planned) |
| Other languages | 🔲 Planned | Go, Rust, Java, Ruby |

## How It Works

```
Initial run (automatic):
  Source files → Scanner → Extractor → Local signal store

Later queries:
  User query → Signal search → File/route/function metadata → Optional targeted source read
```

**Important:** Signals are a map, not the territory. Source code remains the ground truth.

## Quick Start

### Setup

```bash
npm install -g context-signals-mcp
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

## v1.1 New Features

- **Auto-Index Bootstrap** - MCP automatically indexes your project on startup. No manual `signals_scan` needed.
- **Incremental Indexing** - Only changed files are re-indexed. Unchanged files stay cached.
- **Enhanced Stats** - New `signals_stats` shows storage efficiency, token savings, retrieval quality, and break-even status.

## Recommended Workflow

1. MCP auto-indexes on startup (no action needed)
2. Use `signals_search` for navigation/discovery queries
3. Use returned file/line metadata to decide if source reading is needed
4. For implementation questions, read targeted source ranges
5. Changed files are incrementally re-indexed automatically

## Cold Start vs Warm Cache

| Mode | What Happens | Result |
|------|--------------|--------|
| **Cold Start** | Initial indexing cost (8-12 seconds for large projects) | No immediate benefit |
| **Warm Cache** | Signals already indexed | 81-95% context reduction |
| **Incremental** | Only changed files re-indexed | Fast updates |

## When It Works Best

- Medium to large codebases (50+ files)
- Repeated navigation and discovery questions
- Long-lived projects with evolving codebases
- Agents that ask "where is...", "find...", "show routes..."
- Persistent agent workflows

## Per-Query Results (Evaluated Benchmarks)

### Cal.com TRPC (426 files)

| Query Type | Avg Context Reduction |
|------------|---------------------|
| Exploration queries | 71% |
| Task-based queries | 67% |

### Trigger.dev Core (246 files)

| Query Type | Avg Context Reduction |
|------------|---------------------|
| Exploration queries | 94% |
| Task-based queries | 92% |

## Signal Types

| Kind | Description |
|------|-------------|
| `function` | Function definitions |
| `class` | Classes, interfaces, types |
| `import` | Import statements |
| `route` | API routes |
| `component` | React components |

## Roadmap (v1.1 Complete ✓)

- [x] Auto-index when signal store is empty
- [x] Incremental indexing for changed files
- [x] Enhanced signals_stats with user-facing metrics
- [ ] Multi-language support (Python experimental, others planned)
- [ ] Framework extractors for Django, Flask, Gin
- [ ] Optional LSP enrichment
- [ ] Query intent detection
- [ ] Targeted file/range reads

## Privacy

- No code sent to external servers
- Signals stored locally in `.crush-memory/`
- Users control generated signal files

## License

MIT