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

### Planned
- Native Python AST support
- Framework-specific extractors (Django, Flask, Gin, Echo, Axum, Spring)
- Optional LSP enrichment for enhanced symbols
- Query intent detection
- Targeted file/range read support
- Stronger benchmark harness with comparison to grep, ripgrep, LSP, and semantic search
- Multi-language support via tree-sitter (Go, Rust, Java, Ruby, C#)
