# v0.8 Agent Navigation Benchmark

**Purpose**: Measure whether Context Signals MCP improves real agent navigation in a production codebase (LiteLLM).

**Model**: MiniMax M2.7
**Engine**: OpenCode
**Repo**: Real LiteLLM (pinned stable release)

---

## Benchmark Design

### Question Being Answered

> Even with a strong coding agent (MiniMax M2.7), does Context Signals reduce navigation waste?

### Modes

| Mode | Description |
|------|-------------|
| **no-mcp** | OpenCode with grep/shell tools only |
| **cs-deterministic** | OpenCode + Context Signals MCP (BM25 + graph) |
| **cs-embeddings** | OpenCode + Context Signals MCP (with local embeddings reranking) |

### Metrics

| Metric | What it measures |
|--------|-----------------|
| Task Success Rate | Correct file + symbol found |
| Files Opened | Navigation efficiency |
| Wrong Files | Precision (files opened that weren't relevant) |
| Chars Read | Context reduction |
| MCP Calls | Whether agent uses MCP tools |
| Latency | Time to answer |

### Go/No-Go Criteria

```
GO if:
  Mode B or C shows >= 25% fewer wrong files than Mode A
  AND task success rate is same or better

NO-GO if:
  M2.7 ignores MCP tools
  OR same files opened with/without MCP
  OR task success degrades with MCP
```

---

## Directory Structure

```
v0.8/
  tasks/
    v0.8-tasks.json          # 10 LiteLLM navigation tasks
    benchmark-metadata.json  # Benchmark configuration
  configs/
    opencode.no-mcp.jsonc       # Mode A config
    opencode.with-mcp.jsonc     # Mode B config
    opencode.with-embeddings.jsonc  # Mode C config
  scripts/
    clone-litellm.sh         # Clone LiteLLM at stable release
    run-agent-benchmark.ts   # Main benchmark harness
    parse-sessions.ts        # Parse opencode export data
    analyze-results.ts       # Aggregate and compare results
  results/                   # Benchmark runs output
  replays/                   # Session exports for replay
  README.md
```

---

## Platform Requirements

**IMPORTANT**: This benchmark requires **WSL/Linux** for automated execution.

Windows is not supported for automated OpenCode capture due to a TTY-based output limitation in the Windows opencode CLI. See `docs/WINDOWS_LIMITATION.md` for details.

On Windows, opencode sessions ARE created successfully, but output cannot be captured programmatically.

### Running on WSL/Linux

```bash
# In WSL
./benchmarks/agent/v0.8/scripts/linux-dryrun.sh  # Verify capture works
npx ts-node benchmarks/agent/v0.8/scripts/run-agent-benchmark.ts benchmarks/repos/litellm-live
```

---

## Setup

### 0. Platform Check

This benchmark runs on **WSL/Linux only**. Windows automated execution is not supported.

If on Windows with WSL:
```bash
wsl
cd /path/to/context-signals-mcp
```

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
# Edit .env with your MINIMAX_API_KEY
```

### 3. Clone LiteLLM

```bash
./benchmarks/agent/v0.8/scripts/clone-litellm.sh
```

This clones LiteLLM at the latest stable release tag.

### 4. Build MCP Server

```bash
npm run build
```

### 5. Run Benchmark

```bash
# Full benchmark (90 runs)
npx tsx benchmarks/agent/v0.8/scripts/run-agent-benchmark.ts benchmarks/repos/litellm-live

# Or use the compiled JS
node dist/benchmarks/agent/v0.8/scripts/run-agent-benchmark.js benchmarks/repos/litellm-live
```

---

## Expected Results

### For LiteLLM-style Semantic-Heavy Codebases

We expect CS to show:
- **Fewer wrong files opened**
- **Higher precision in navigation**
- **Similar or better task success**

### For Simple/Well-Structured Codebases

We expect minimal difference between modes because grep is already efficient.

---

## Important Notes

1. **Model Matters**: Results reflect MiniMax M2.7 behavior. Other models may show different patterns.

2. **Real Repo**: This benchmark uses the real LiteLLM repo, not a fixture. Results reflect actual agent behavior.

3. **Frozen Tasks**: The 10 tasks are fixed. We don't modify them after the benchmark starts.

4. **No Fixture Contamination**: v0.8 uses real LiteLLM, separate from the fixture-based benchmarks (v0.3-v0.7).

---

## Scientific Framing

This benchmark measures:

```
Context Signals × Model Capability
```

Not:

```
Context Signals alone
```

This is more honest and scientifically defensible.

---

## Previous Benchmarks

| Version | Focus | Key Finding |
|---------|-------|-------------|
| v0.3-0.5 | Retrieval tuning | No gain from algorithm tuning |
| v0.6 | Embeddings experiment | +26.7% on LiteLLM (semantic cases) |
| v0.7 | Navigation harness | +6% ground truth found (mechanical, no LLM) |
| v0.8 | **Agent task benchmark** | **With LLM: does CS actually help?** |

---

## Next

After v0.8 (MiniMax M2.7), the same benchmark can be run on:
- GPT-4.6 / GPT-5-class
- Claude Sonnet / Opus

This would reveal how Model × CS interaction varies across capability levels.