# Context Signals MCP Benchmark Results
**Date:** 2026-04-30
**Version:** MCP 1.1.0 + Python extension patch

---

## Summary

| Metric | TodoAPI (Small) | PhotoVerify (Medium) |
|--------|-----------------|---------------------|
| Files | 3 | 24 |
| Raw Source Chars | 4,473 | 38,970 |
| **Storage Reduction** | **83%** | **20%** |
| **Baseline Tokens/Query** | 1,118 | 3,911 |
| **MCP Tokens/Query** | 816 | 814 |
| **Token Savings** | **27%** | **79%** |

---

## 1. Storage Efficiency

### TodoAPI
| Metric | Value |
|--------|-------|
| Raw Source | 4,473 chars |
| Signal Storage | 778 chars |
| Signals Created | 21 |
| Reduction | **83%** |

### PhotoVerify
| Metric | Value |
|--------|-------|
| Raw Source | 38,970 chars |
| Signal Storage | 31,128 chars |
| Signals Created | 74 |
| Reduction | **20%** |

---

## 2. Input Token Reduction

### TodoAPI
| Query | Baseline | MCP | Savings |
|-------|----------|-----|---------|
| todo-001 | 1,118 | 1,001 | 10% |
| todo-002 | 1,118 | 131 | 88% |
| todo-003 | 1,118 | 989 | 12% |
| todo-004 | 1,118 | 999 | 11% |
| todo-005 | 1,118 | 961 | 14% |
| **Average** | **1,118** | **816** | **27%** |

### PhotoVerify
| Query | Baseline | MCP | Savings |
|-------|----------|-----|---------|
| pv-001 | 4,994 | 1,004 | 80% |
| pv-002 | 4,209 | 1,019 | 76% |
| pv-003 | 2,497 | 274 | 89% |
| pv-004 | 4,994 | 862 | 83% |
| pv-005 | 2,863 | 913 | 68% |
| **Average** | **3,911** | **814** | **79%** |

---

## 3. Retrieval Quality

### TodoAPI
| Metric | Value |
|--------|-------|
| Total Searches | 5 |
| Avg Results/Query | 6.6 |
| Top-3 Hit Rate | 100% |
| Zero-Result Queries | 0 |

### PhotoVerify
| Metric | Value |
|--------|-------|
| Total Searches | 5 |
| Avg Results/Query | 6.8 |
| Top-3 Hit Rate | 100% |
| Zero-Result Queries | 0 |

---

## 4. Query Response Time (ms)

### TodoAPI
| Query | Baseline | MCP | Speedup |
|-------|----------|-----|---------|
| todo-001 | 107 | 12 | **8.9x** |
| todo-002 | 112 | 5 | **22x** |
| todo-003 | 146 | 5 | **29x** |
| todo-004 | 95 | 7 | **14x** |
| todo-005 | 145 | 5 | **29x** |

### PhotoVerify
| Query | Baseline | MCP | Speedup |
|-------|----------|-----|---------|
| pv-001 | 84 | 15 | **5.6x** |
| pv-002 | 61 | 8 | **7.6x** |
| pv-003 | 146 | 8 | **18x** |
| pv-004 | 141 | 6 | **24x** |
| pv-005 | 127 | 5 | **25x** |

---

## 5. Cold-Start Cost (Indexing)

### TodoAPI
| Metric | Value |
|--------|-------|
| Indexing Time | 43ms |
| Files Indexed | 3 |
| Signals Created | 21 |
| Indexing Cost | ~14ms/file |

### PhotoVerify
| Metric | Value |
|--------|-------|
| Indexing Time | 314ms |
| Files Indexed | 24 |
| Signals Created | 74 |
| Indexing Cost | ~13ms/file |

---

## 6. Break-Even Analysis

### TodoAPI
- Indexing chars: 4,473
- Avg savings/query: ~302 chars
- **Break-even queries: ~15**

### PhotoVerify
- Indexing chars: 38,970
- Avg savings/query: ~3,097 chars
- **Break-even queries: ~13**

---

## Key Findings

1. **Significant token reduction**: MCP reduces input tokens by 27-79% depending on project size
2. **Massive speedup**: Query response times improved 5-29x
3. **High retrieval quality**: 100% top-3 hit rate across all queries
4. **Fast indexing**: ~13-14ms per file indexing cost
5. **Low break-even**: Break-even at 13-15 queries per project

## Caveats

- Python files are being processed with TypeScript extractors (language shows as "typescript" in results)
- Signal extraction for Python may not be optimal without Python-specific extractors
- MCP is still reading full file contents for search (not pure signals)

## Test Configuration

- **MCP Server**: context-signals-mcp v1.1.0 + Python extension patch
- **MCP Command**: `npx -y context-signals-mcp`
- **Supported Extensions**: .py, .ts, .tsx, .js, .jsx, .mjs, .cjs, .go, .java, .rb, .php, .rs, .swift, .kt