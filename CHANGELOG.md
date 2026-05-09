# Changelog

All notable changes to the Context Signals MCP project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.2] - 2026-05-05

### Added
- **Auto-Index Bootstrap**: MCP server now automatically indexes your project on startup. No manual `signals_scan` needed
- **Incremental Indexing**: Only changed files are re-indexed. Unchanged files stay cached, dramatically reducing scan times ([dc812b4](https://github.com/dineshrag/context-signals-mcp/commit/dc812b4))
- **Per-File Metadata Tracking**: New `.crush-memory/file-meta.json` tracks file modifications using mtime and content hashes for accurate incremental updates
- **Index Store**: New `src/storage/index-store.ts` manages index metadata with version tracking
- **Incremental Scanner**: New `src/scanner/incremental-scanner.ts` implements hybrid mtime + hash change detection
- **Metrics Store**: New `src/storage/metrics-store.ts` records indexing performance statistics
- **Enhanced Stats**: `signals_stats` tool now shows storage efficiency, token savings, retrieval quality, and break-even status
- **Force Rescan Option**: `signals_scan` tool accepts `force: true` to bypass incremental logic when full re-index is needed

### Changed
- **README Overhaul**: Completely restructured README with clearer problem framing, 10-second example, and grounded benchmark claims
- **Benchmark Documentation**: Added real-world benchmark reports for Cal.com TRPC (81% reduction), Trigger.dev Core (95% reduction), and PhotoVerify (79% reduction)
- **Server Startup**: Modified `src/index.ts` to trigger background indexing on startup if signal store is empty or stale
- **Scan Tool**: Updated `src/tools/signals-scan.ts` to default to incremental scanning with intelligent fallback
- **Ignore Rules**: Enhanced `src/scanner/ignore-rules.ts` with additional patterns for better file discovery

### Fixed
- **Cold Start Problem**: Eliminated the ~10x performance penalty and +65.6% overhead on small projects caused by empty signal store
- **Unnecessary Re-scans**: Full re-scan no longer required after every code change
- **Double Overhead**: Removed fallback reads that occurred when signal store was empty

### Performance
- Subsequent scans now target <10% of full scan duration
- Signal lookup 5-29x faster than reading files
- Break-even point achieved in ~5-15 queries depending on project size
- Warm-cache navigation queries achieve 81-95% context reduction

### Documentation
- Added `V1.1Implementation_Plan.md` with detailed technical specification
- Added `FEATUREENHANCEMENTS.md` with multi-language support roadmap
- Updated benchmark findings with grounded real-world claims
- Added `docs/benchmark-findings.html` with interactive benchmark visualization

---

## [1.0.0] - 2026-04-30

### Added
- Initial implementation of Context Signals MCP Server
- AST-based extraction for TypeScript and JavaScript
- Support for functions, classes, interfaces, types, imports, exports
- API route extraction for Express, Fastify, and Next.js
- React component detection
- BM25 search with hybrid scoring
- Signal storage in `.crush-memory/signals.json`
- MCP tools: `signals_scan`, `signals_search`, `signals_stats`, `signals_clear`, `signals_kinds`, `signals_benchmark`
- Stdio transport for MCP server
- OpenCode and Claude Desktop configuration examples
- Benchmark harness for evaluating context reduction

---

## [Unreleased]

### v0.7 - 2026-05-09 (Navigation Outcome Benchmark Complete)

**Status**: Navigation benchmark validates CS improves ground truth discovery without LLM.

**Experiment**: Compare grep/search vs context_signals.search navigation efficiency.

**Results**:

| Project | Ground Truth Found (Baseline → CS) | File Open Change |
|---------|-----------------------------------|------------------|
| LiteLLM | 100% → 100% | -27% (better) |
| DRF | 100% → 100% | 0% |
| FastAPI | 67% → 100% | 0% |
| Flask | 75% → 75% | -120% (worse) |

**Overall**: 88% → 94% ground truth found (+6%), 8% chars read reduction.

**Key Insight**: CS improves **precision** (finding correct content) not necessarily **efficiency** (fewer files). FastAPI and LiteLLM benefit most.

**Added in v0.7**:
- `src/benchmark/navigation-harness.ts` - Navigation outcome benchmark
- `benchmarks/navigation-tasks.json` - 16 navigation task definitions
- `run-navigation-benchmark.js` - CLI runner

**v0.8 Next**: Add LLM involvement for real agent task benchmark.

---

### v0.6 - 2026-05-09 (Embeddings Experiment Complete)

**Status**: Embeddings remain optional toggle, off by default.

**Experiment**: Local embeddings (all-MiniLM-L6-v2, 384 dim) as reranker on top-k BM25+graph results.

**Results**:

| Project | Baseline | +Embeddings | Improvement |
|---------|----------|-------------|-------------|
| LiteLLM | 6.7% | 33.3% | +26.7% **significant** |
| DRF | 33.3% | 40% | +6.7% not significant |
| Flask | 73.3% | 100% | +26.7% but baseline already strong |
| FastAPI | 73.3% | 80% | +6.7% not significant |

**Decision Rule Applied**:
- LiteLLM improvement (26.7%) > 20% threshold → **PASS** (embeddings helpful for semantic matching in LLM codebases)
- DRF improvement (6.7%) < 15% threshold → **FAIL** (most failures are `missing_signal_kind`, embeddings can't help)

**Conclusion**: Embeddings stay as optional toggle, off by default. They improve semantic matching where lexical+graph fail (e.g., "chat" → "completion"), but cannot fix missing signal gaps.

**Added in v0.6**:
- `src/retrieval/embeddings/local.ts` - LocalEmbeddingsReranker class
- `src/benchmark/embeddings-experiment.ts` - Experiment harness
- `run-embeddings-experiment.js` - CLI runner

**Operational Metrics**:
- Model size: 90MB
- Index time: 68-330ms (scales with signal count)
- Query latency overhead: 2-4ms per query
- 0 regressions across all projects

---

### v0.5 - 2026-05-09 (FROZEN - Deterministic Baseline)

**Status**: Frozen as deterministic baseline. No further algorithm tuning.

**Three Algorithm Tuning Iterations Produced Zero Measurable Gain**:

| Version | Change | Result |
|---------|--------|--------|
| v0.3 | BM25 baseline | Baseline |
| v0.4 | +chain-aware reranking | No improvement |
| v0.5 | +semantic normalization | No improvement |

**Key Finding**: Retrieval algorithm tuning is not the bottleneck. Signal coverage and query-to-symbol semantic mapping are the bottlenecks.

**Added in v0.5**:
- `SIGNAL_TO_NORMAL` dictionary (plural→singular normalization)
- `DOMAIN_TERM_NORMALIZATION` (api/rest→endpoint)
- `normalizeQueryTerm()` and `normalizeSignalTerm()` functions
- Enhanced `extractQueryIntent()` with normalization expansion
- `ChainAwareResult` interface and `computeChainScore()` for graph-based reranking

**Failure Analysis**:
- LiteLLM: 9/10 failures are `missing_graph_edge` (query expects "chat" in file path, signals don't have it)
- DRF: 8/10 failures are `missing_signal_kind` (query expects router config, fixture has no such signal)
- FastAPI: 2/3 failures are `lexical_mismatch` (query "password reset" vs signal "resetPassword")

**Conclusion**: Context Signals works well when structural signals exist and query terms map to indexed symbols. It is weak when required concepts are absent or semantically distant from indexed symbols.

**Next**: v0.6 will test local embeddings as optional semantic reranker on top-k results.

---

### Planned
- Native Python AST support
- Framework-specific extractors (Django, Flask, Gin, Echo, Axum, Spring)
- Optional LSP enrichment for enhanced symbols
- Query intent detection
- Targeted file/range read support
- Stronger benchmark harness with comparison to grep, ripgrep, LSP, and semantic search
- Multi-language support via tree-sitter (Go, Rust, Java, Ruby, C#)
