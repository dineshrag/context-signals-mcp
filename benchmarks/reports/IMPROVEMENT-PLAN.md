# Context Signals MCP: Honest Assessment & Improvement Roadmap

## What I'm Proud Of

### The Core Insight
The idea is sound - extracting structural metadata (signals) from code creates a reusable navigation layer. The numbers prove this works for discovery:

- 100% top-3 hit rate for finding relevant files
- Massive token reduction in the *discovery* phase
- The concept of "signals" as first-class citizens

### Technical Implementation
- AST-based extraction for JS/TypeScript is solid
- Hybrid search (BM25 + scoring) works well
- Auto-indexing on startup is convenient
- Signal store is efficient (compact JSON vs raw source)

### Real Problem Solved
Developers genuinely waste context reading files just to find where things are. This solves that.

---

## What I'd Improve (Honest Assessment)

### 1. The Benchmark Methodology is Flawed
Our benchmarks compared against a strawman baseline that:
- Scanned ALL files (not how real RAG works)
- Dumped all matches (not smart retrieval)
- Measured tokens returned, not actual cost to complete tasks

**Fix needed**: Compare against actual RAG systems, measure end-to-end task completion.

### 2. Signal Accuracy Issues
Looking at results, signals often point to:
- Test fixtures instead of real implementations
- Imports/exports instead of actual logic
- Line ranges are too wide (e.g., 0-65 lines for a simple function)

**Fix needed**: Better scoring, framework-specific extractors, tighter line ranges.

### 3. No Implementation Support
Signals help you *find* code, but you still need to *read* it. The tool stops at navigation.

**Fix needed**:
- `signals_read` tool: Read specific line ranges from signal locations
- `signals_understand` tool: Return contextual snippets around signals

### 4. Python Support is Experimental
The docs admit Python uses "generic extractors" - meaning it doesn't actually parse Python ASTs.

**Fix needed**: Native Python AST extraction or partner with python-language-server.

### 5. Cold Start is Expensive
Indexing time:
- shadcn (376 files): ~12s per query × 25 queries = 5 min wasted indexing
- Prisma (1,847 files): ~180s per query = effectively unusable

The incremental scanner exists but isn't working well in practice.

**Fix needed**:
- Persistent index that survives sessions
- Background indexing during idle time
- Better incremental update detection

### 6. The "99% Reduction" Claim is Misleading
What we actually measure:
- Signal metadata returned: ~365 tokens
- What we DON'T measure:
  - Indexing cost (amortized but real)
  - File reads AFTER signals (required for implementation)
  - Context to understand the found code

**Reality**: For implementation tasks, expect 40-60% reduction, not 99%.

### 7. No Cost Analysis in Marketing
The README shows token reduction but doesn't show:
- Indexing compute cost
- Dollar savings
- Break-even analysis for different team sizes

---

## Step-by-Step Improvement Roadmap

### Phase 1: Fix the Basics (Quick Wins)
- [ ] Fix line range extraction (too wide)
- [ ] Improve result ranking (test fixtures shouldn't top results)
- [ ] Add signals_read tool for targeted file reads
- [ ] Document realistic numbers (40-60% not 99%)

### Phase 2: Performance
- [ ] Persistent index storage (don't rebuild every session)
- [ ] Background indexing
- [ ] Better incremental scanning
- [ ] Cache warm-up on startup

### Phase 3: Accurate Benchmarking
- [ ] Compare against real RAG (not strawman)
- [ ] Measure end-to-end task completion
- [ ] Add dollar cost calculation
- [ ] Test implementation tasks, not just navigation

### Phase 4: Scale
- [ ] Python native support
- [ ] Go/Rust/Java extractors
- [ ] Larger codebase optimization (Prisma takes 3min/query)
- [ ] Parallel indexing

### Phase 5: Integration
- [ ] VS Code extension
- [ ] JetBrains plugin
- [ ] CI/CD integration for index updates
- [ ] Team signal sharing

---

## Honest Marketing (What to Tell Users)

| Claim | Reality |
|-------|---------|
| "99% token reduction" | ~40-60% for actual implementation tasks |
| "Faster navigation" | Yes, for discovery phase only |
| "Works with Python" | Experimental, limited extraction |
| "Auto-indexes" | Yes, but slow on large codebases |
| "100% accuracy" | Signal locations are accurate, but test fixtures often rank higher |

---

## The Hard Truth

### The tool is genuinely useful for:
- Large codebases with complex navigation
- Discovery queries ("where is X?")
- Teams that waste context on repeated file hunting

### The tool is oversold for:
- Token reduction claims (inflated by flawed benchmarks)
- Python support (experimental at best)
- Implementation tasks (you still need to read files)
- Small projects (indexing cost > savings)

### What would make it world-class:
1. Honest benchmarks against real RAG
2. Native Python support
3. Persistent indexes
4. `signals_read` tool for targeted extraction
5. Dollar cost analysis, not just token counts

---

## Original Question Answered

> Does this really reduce tokens and cost?

**Yes, but not 99%. For discovery: ~90%. For implementation: ~40-60%.**

**Does it reduce cost?** Yes, but the compute cost of indexing partially offsets savings on small teams.

**Is it worth it?** For large teams working in large codebases daily - absolutely. For one-off queries - no.

---

*Generated: 2026-05-01*
*Benchmark Data: docs/BENCHMARK-REPORT-REALWORLD-V2.md*