# Feature Enhancements: Multi-Language Support

## Overview

This document outlines the plan to extend Context Signals MCP from JavaScript/TypeScript-only to support multiple programming languages using a hybrid approach that combines native parsers with Tree-sitter.

---

## Current State

| Language | Framework | Implementation | Status |
|----------|-----------|----------------|--------|
| TypeScript | All | TypeScript Compiler API (AST) | ✅ Complete |
| JavaScript | All | TypeScript Compiler API (parses JS) | ✅ Complete |
| Python | Any | No implementation | ❌ Not supported |
| Go | Any | No implementation | ❌ Not supported |
| Rust | Any | No implementation | ❌ Not supported |
| Java | Any | No implementation | ❌ Not supported |
| C# | Any | No implementation | ❌ Not supported |
| Ruby | Any | No implementation | ❌ Not supported |

---

## Hybrid Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Signal Interface                      │
│         (function, class, route, import, etc.)          │
└─────────────────────────────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   Native AST     │ │   Tree-sitter   │ │   Future        │
│   (Tier 1)       │ │   (Tier 2)      │ │   (Tier 3)      │
├─────────────────┤ ├─────────────────┤ ├─────────────────┤
│ TypeScript  ✅   │ │ Python    🟡    │ │ Any language     │
│ JavaScript  ✅   │ │ Go        🟡    │ │ requiring native │
│                 │ │ Rust      🟡    │ │ precision        │
│                 │ │ Java      🟡    │ │                 │
│                 │ │ C#        🟡    │ │                 │
│                 │ │ Ruby      🟡    │ │                 │
│                 │ │ PHP       🟡    │ │                 │
│                 │ │ C/C++     🟡    │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘

Legend: ✅ = Existing   🟡 = New via tree-sitter
```

### Tier Definitions

**Tier 1 - Native Parsers (Maximum Accuracy)**
- TypeScript/JavaScript: Use TypeScript Compiler API (existing)
- Rationale: Official Microsoft implementation, highest accuracy for JS/TS

**Tier 2 - Tree-sitter (High Accuracy + Broad Coverage)**
- Python, Go, Rust, Java, C#, Ruby, PHP, C/C++
- Rationale: 95-98% accuracy sufficient for navigation/discovery
- Fast implementation, single API for all languages

**Tier 3 - Future/On-Demand**
- Languages requiring native parser precision
- Implement only if Tier 2 proves insufficient for specific use cases

---

## Implementation Phases

### Phase 1: Tree-sitter Infrastructure

**Timeline:** Week 1-2

| Task | Effort | Description |
|------|--------|-------------|
| Integrate tree-sitter | 1 day | Add tree-sitter packages to dependencies |
| Create tree-sitter wrapper | 2 days | Adapter to convert tree-sitter nodes to Signal interface |
| Define unified Signal mapping | 2 days | Map tree-sitter node types to Signal kinds |
| Create base tree-sitter extractor | 2 days | Abstract base class for language extractors |
| **Subtotal** | ~1 week | Core infrastructure |

**Deliverables:**
- `src/extractors/tree-sitter/` directory with base infrastructure
- `TreeSitterAdapter` class
- `BaseTreeSitterExtractor` abstract class

---

### Phase 2: Core Languages via Tree-sitter

**Timeline:** Week 2-4

| Language | Tree-sitter Grammar | Priority | Effort |
|----------|-------------------|----------|--------|
| Python | `tree-sitter-python` | 🔴 High | 2 days |
| Go | `tree-sitter-go` | 🔴 High | 2 days |
| Rust | `tree-sitter-rust` | 🔴 High | 2 days |
| Java | `tree-sitter-java` | 🟡 Medium | 2 days |
| C# | `tree-sitter-c-sharp` | 🟡 Medium | 2 days |
| Ruby | `tree-sitter-ruby` | 🟢 Low | 2 days |

**Deliverables:**
- `src/extractors/tree-sitter/python.ts`
- `src/extractors/tree-sitter/go.ts`
- `src/extractors/tree-sitter/rust.ts`
- `src/extractors/tree-sitter/java.ts`
- `src/extractors/tree-sitter/csharp.ts`
- `src/extractors/tree-sitter/ruby.ts`

---

### Phase 3: Framework Detection via Tree-sitter

**Timeline:** Week 4-5

| Framework | Language | Tree-sitter Based | Effort |
|-----------|----------|-------------------|--------|
| Django | Python | ✅ | 2 days |
| Flask/FastAPI | Python | ✅ | 2 days |
| Gin/Echo | Go | ✅ | 2 days |
| Axum | Rust | ✅ | 2 days |
| Spring | Java | ✅ | 2 days |
| Rails | Ruby | ✅ | 2 days |
| Express | JS/TS | Already exists | N/A |
| Fastify | JS/TS | Already exists | N/A |
| Next.js | JS/TS | Already exists | N/A |

**Deliverables:**
- `src/extractors/tree-sitter/frameworks/python/` - Django, Flask, FastAPI
- `src/extractors/tree-sitter/frameworks/go/` - Gin, Echo
- `src/extractors/tree-sitter/frameworks/rust/` - Axum
- `src/extractors/tree-sitter/frameworks/java/` - Spring
- `src/extractors/tree-sitter/frameworks/ruby/` - Rails

---

### Phase 4: Validation & Polish

**Timeline:** Week 5-6

| Task | Effort | Description |
|------|--------|-------------|
| Unit tests per language | 3 days | Test extraction for each language |
| Integration tests | 2 days | Cross-language workflow tests |
| Benchmark accuracy | 2 days | Compare tree-sitter vs native where possible |
| Documentation | 2 days | Update docs with new language support |
| **Subtotal** | ~1.5 weeks | Quality assurance |

**Deliverables:**
- Test fixtures for each new language
- Updated benchmark suite
- Language-specific documentation

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 1-2 weeks | Tree-sitter infrastructure |
| Phase 2 | 2-3 weeks | 5 core languages (Python, Go, Rust, Java, C#) |
| Phase 3 | 2 weeks | Framework extractors for new languages |
| Phase 4 | 1.5 weeks | Testing, validation, docs |
| **Total** | **6-8 weeks** | Full multi-language support |

---

## Node Type Mapping

### Signal Kinds to Tree-sitter Node Types

| Signal Kind | Python | Go | Rust | Java | C# |
|-------------|--------|-----|------|------|-----|
| `function` | `function_definition` | `function_declaration` | `function_item` | `method_declaration` | `method_declaration` |
| `class` | `class_definition` | `type_declaration` | `struct_item` | `class_declaration` | `class_declaration` |
| `import` | `import_statement` | `import_declaration` | `use_declaration` | `import_declaration` | `using_directive` |
| `route` | Django: `url_pattern`, Flask: `route decorator` | Gin/Echo: `router.Method` | Axum: `router.route` | Spring: `@RequestMapping` | ASP.NET: `[Route]` |
| `interface` | `interface_definition` | `interface_type` | `trait_item` | `interface_declaration` | `interface_declaration` |
| `type` | `type_alias` | `type_spec` | `type_alias` | `type_declaration` | `type_declaration` |

---

## Accuracy Comparison

| Approach | Accuracy | Best For |
|----------|----------|----------|
| Native Parsers | 100% | TypeScript/JavaScript (existing) |
| Tree-sitter | 95-98% | Python, Go, Rust, Java, C#, Ruby, PHP, C/C++ |
| Hybrid Target | 95-98% overall | Navigation and discovery queries |

**Note:** Tree-sitter at 95-98% accuracy is sufficient for navigation/discovery use cases because:
- Structural metadata (functions, classes, imports) is well-supported
- Minor parsing differences rarely affect navigation queries
- Speed and breadth benefits outweigh marginal accuracy gains

---

## File Structure (Post-Implementation)

```
src/
├── extractors/
│   ├── ast/
│   │   ├── typescript.ts       # Existing - Tier 1
│   │   └── javascript.ts        # Existing - Tier 1
│   ├── framework/
│   │   ├── express.ts           # Existing - JS/TS
│   │   ├── fastify.ts          # Existing - JS/TS
│   │   ├── nextjs.ts           # Existing - JS/TS
│   │   ├── react.ts            # Existing - JS/TS
│   │   └── [new frameworks]/   # Future - new languages
│   ├── tree-sitter/
│   │   ├── index.ts            # New - base infrastructure
│   │   ├── adapter.ts          # New - tree-sitter to Signal adapter
│   │   ├── base-extractor.ts   # New - abstract base class
│   │   ├── python.ts           # New - Tier 2
│   │   ├── go.ts               # New - Tier 2
│   │   ├── rust.ts             # New - Tier 2
│   │   ├── java.ts             # New - Tier 2
│   │   ├── csharp.ts           # New - Tier 2
│   │   ├── ruby.ts             # New - Tier 2
│   │   └── frameworks/
│   │       ├── python/
│   │       │   ├── django.ts
│   │       │   ├── flask.ts
│   │       │   └── fastapi.ts
│   │       ├── go/
│   │       │   ├── gin.ts
│   │       │   └── echo.ts
│   │       ├── rust/
│   │       │   └── axum.ts
│   │       ├── java/
│   │       │   └── spring.ts
│   │       └── ruby/
│   │           └── rails.ts
│   └── fallback/
│       └── regex.ts            # Existing - error recovery
```

---

## Open Questions

- [ ] Which languages are top priority? (Affects Phase 2 sequencing)
- [ ] Is 6-8 weeks timeline acceptable?
- [ ] Should existing JS/TS remain with TypeScript Compiler API or refactor to tree-sitter for consistency?
- [ ] Which frameworks are most critical for new languages?
- [ ] Should Tier 3 (native parsers for specific languages) be planned now or deferred?

---

## Success Criteria

1. **Coverage:** Extract signals from at least 5 new languages (Python, Go, Rust, Java, C#)
2. **Accuracy:** 95%+ retrieval accuracy for navigation queries in new languages
3. **Performance:** Signal extraction within 2x time of JS/TS extraction
4. **Integration:** New languages work seamlessly with existing Signal interface
5. **Framework Support:** At least one framework extractor per new language

---

## Future Enhancements (Post v1.0)

- [ ] Auto-detection of language from file extension
- [ ] Language-agnostic query search across all indexed languages
- [ ] Cross-language import/export detection
- [ ] Framework-specific route extraction for all supported languages
- [ ] Incremental extraction for large monorepos
- [ ] LSP integration for enhanced symbol resolution
- [ ] Query intent detection (navigation vs implementation)
- [ ] Targeted source read suggestions based on signal location
