export interface QueryIntent {
  originalQuery: string
  terms: string[]
  expandedTerms: string[]
  frameworkHints: string[]
  kindHints: string[]
  queryType: "simple" | "architectural" | "multihop" | "failure"
}

const STOP_WORDS = new Set([
  "how", "does", "the", "a", "an", "is", "are", "what", "where", "when", "why",
  "who", "which", "can", "could", "would", "should", "will", "do", "does", "did",
  "have", "has", "had", "be", "been", "being", "this", "that", "these", "those",
  "in", "on", "at", "to", "for", "with", "by", "from", "up", "about", "into",
  "through", "during", "before", "after", "above", "below", "between", "under",
  "again", "further", "then", "once", "here", "there", "all", "each", "few",
  "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own",
  "same", "so", "than", "too", "very", "just", "also", "now", "work", "flow",
])

const FRAMEWORK_KEYWORDS: Record<string, string[]> = {
  express: ["express", "router", "app.get", "app.post", "app.put", "app.delete", "middleware"],
  fastapi: ["fastapi", "router", "app.get", "app.post", "endpoint"],
  flask: ["flask", "app.route", "view", "request"],
  nextjs: ["nextjs", "page", "api", "getServerSideProps", "getStaticProps"],
  react: ["react", "component", "useState", "useEffect", "jsx", "tsx"],
}

const KIND_KEYWORDS: Record<string, string[]> = {
  function: ["function", "method", "def", "async", "handler", "callback"],
  class: ["class", "classdef", "constructor", "object"],
  route: ["route", "endpoint", "api", "GET", "POST", "PUT", "DELETE", "PATCH"],
  component: ["component", "render", "view", "page", "screen"],
  import: ["import", "require", "from", "include", "use"],
  middleware: ["middleware", "interceptor", "before", "after", "hook"],
}

const SIGNAL_TERM_MAPPING: Record<string, string[]> = {
  auth: ["auth", "login", "logout", "token", "jwt", "session", "password", "credential"],
  user: ["user", "account", "profile", "register", "signup"],
  api: ["api", "rest", "endpoint", "route", "request", "response"],
  db: ["db", "database", "query", "sql", "mongodb", "postgres"],
  config: ["config", "setting", "env", "environment", "initialize", "configuration"],
  error: ["error", "exception", "handler", "catch", "try", "throw"],
  upload: ["upload", "file", "multipart", "storage", "s3"],
  validate: ["validate", "validation", "schema", "type", "check"],
  serializer: ["serializer", "serializers", "serialization", "marshalling"],
  view: ["view", "views", "viewset", "ViewSet", "endpoint"],
  router: ["router", "routers", "routing", "route", "urls"],
  middleware: ["middleware", "middlewares", "interceptor", "hook"],
  provider: ["provider", "providers", "llm", "openai", "anthropic", "azure"],
  completion: ["completion", "completions", "chat", "chatcompletion", "inference"],
  streaming: ["streaming", "stream", "sse", "events", "chunk"],
  retry: ["retry", "retries", "backoff", "exponential", "fallback"],
  timeout: ["timeout", "timeouts", "timeout_ms", "deadline"],
  rate_limit: ["rate_limit", "rate-limit", "throttle", "ratelimit", "limiting"],
  implementation: ["implementation", "function", "class", "method", "logic"],
  handler: ["handler", "function", "method", "callback", "endpoint"],
  logic: ["logic", "function", "implementation", "method", "handler"],
  mechanism: ["mechanism", "function", "implementation", "system"],
  work: ["work", "function", "logic", "handle", "process"],
  flow: ["flow", "chain", "pipeline", "sequence", "path"],
  path: ["path", "route", "endpoint", "url", "chain"],
  structure: ["structure", "class", "architecture", "file", "project"],
  architecture: ["architecture", "structure", "design", "system", "overview"],
}

const LLM_SPECIFIC_MAPPING: Record<string, string[]> = {
  completion: ["completion", "completions", "chat", "chatcompletion", "completions"],
  chat: ["chat", "completion", "message", "prompt"],
  provider: ["provider", "llm", "model", "inference"],
  model: ["model", "gpt", "claude", "gemini", "ollama"],
  inference: ["inference", "completion", "prediction"],
  streaming: ["streaming", "stream", "sse", "chunk", "delta"],
  retry: ["retry", "retries", "backoff", "resilience"],
  fallback: ["fallback", "retry", "backup", "secondary"],
  config: ["config", "configuration", "setting", "api_key", "api_base"],
  route: ["route", "routing", "dispatch", "proxy", "load_balance"],
  middleware: ["middleware", "logging", "metrics", "auth"],
}

const COMMON_STEM_PATTERNS: [RegExp, string][] = [
  [/s$/i, ""],
  [/es$/i, ""],
  [/ing$/i, ""],
  [/ed$/i, ""],
  [/ly$/i, ""],
]

function stemWord(word: string): string {
  for (const [pattern, replacement] of COMMON_STEM_PATTERNS) {
    const stemmed = word.replace(pattern, replacement)
    if (stemmed !== word && stemmed.length > 3) {
      return stemmed
    }
  }
  return word
}

function classifyQueryType(query: string): QueryIntent["queryType"] {
  const lower = query.toLowerCase()

  if (lower.includes("all ") || lower.includes("show me all") || lower.includes("list all") ||
      lower.includes("what is the overall") || lower.includes("structure") ||
      lower.includes("architecture") || lower.includes("middleware chain")) {
    return "architectural"
  }

  if (lower.includes("trace") || lower.includes("flow") || lower.includes("how does") ||
      lower.includes("what happens when") || lower.includes("path from")) {
    return "multihop"
  }

  if (lower.includes("error") || lower.includes("fail") || lower.includes("exception") ||
      lower.includes("invalid") || lower.includes("debug") || lower.includes("find")) {
    return "failure"
  }

  return "simple"
}

const SIGNAL_TO_NORMAL: Record<string, string> = {
  serializers: "serializer",
  views: "view",
  routers: "router",
  middlewares: "middleware",
  providers: "provider",
  completions: "completion",
  configurations: "config",
  implementations: "implementation",
  handlers: "handler",
  mechanisms: "mechanism",
}

const DOMAIN_TERM_NORMALIZATION: Record<string, string> = {
  api: "endpoint",
  rest: "endpoint",
  route: "endpoint",
  routers: "router",
  router: "router",
}

export function normalizeSignalTerm(term: string): string {
  const lower = term.toLowerCase()
  if (SIGNAL_TO_NORMAL[lower]) return SIGNAL_TO_NORMAL[lower]
  return stemWord(lower)
}

export function normalizeQueryTerm(term: string): string {
  const lower = term.toLowerCase()
  if (SIGNAL_TO_NORMAL[lower]) return SIGNAL_TO_NORMAL[lower]
  return stemWord(lower)
}

export function extractQueryIntent(query: string): QueryIntent {
  const lower = query.toLowerCase()

  const terms = lower
    .split(/\s+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
    .map(t => normalizeQueryTerm(t))

  const expandedTerms = new Set<string>()

  for (const term of terms) {
    expandedTerms.add(term)
    expandedTerms.add(stemWord(term))

    if (SIGNAL_TERM_MAPPING[term]) {
      SIGNAL_TERM_MAPPING[term].forEach(t => expandedTerms.add(t))
    }

    for (const [key, synonyms] of Object.entries(SIGNAL_TERM_MAPPING)) {
      if (synonyms.includes(term)) {
        expandedTerms.add(key)
        synonyms.forEach(s => expandedTerms.add(s))
      }
    }

    if (SIGNAL_TO_NORMAL[term]) {
      const normal = SIGNAL_TO_NORMAL[term]
      expandedTerms.add(normal)
      if (SIGNAL_TERM_MAPPING[normal]) {
        SIGNAL_TERM_MAPPING[normal].forEach(t => expandedTerms.add(t))
      }
    }

    if (LLM_SPECIFIC_MAPPING[term]) {
      LLM_SPECIFIC_MAPPING[term].forEach(t => expandedTerms.add(t))
    }

    for (const [key, terms_list] of Object.entries(LLM_SPECIFIC_MAPPING)) {
      if (terms_list.includes(term)) {
        expandedTerms.add(key)
        terms_list.forEach(t => expandedTerms.add(t))
      }
    }

    if (DOMAIN_TERM_NORMALIZATION[term]) {
      const normal = DOMAIN_TERM_NORMALIZATION[term]
      expandedTerms.add(normal)
    }
  }

  for (const term of terms) {
    const stemmed = stemWord(term)
    if (stemmed !== term) {
      expandedTerms.add(stemmed)
    }
  }

  const frameworkHints: string[] = []
  for (const [framework, keywords] of Object.entries(FRAMEWORK_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        if (!frameworkHints.includes(framework)) {
          frameworkHints.push(framework)
        }
      }
    }
  }

  const kindHints: string[] = []
  for (const [kind, keywords] of Object.entries(KIND_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        if (!kindHints.includes(kind)) {
          kindHints.push(kind)
        }
      }
    }
  }

  return {
    originalQuery: query,
    terms: Array.from(terms),
    expandedTerms: Array.from(expandedTerms),
    frameworkHints,
    kindHints,
    queryType: classifyQueryType(query),
  }
}

export function queryMatchesSignal(query: string, signalTerms: string[]): number {
  const intent = extractQueryIntent(query)

  let matchScore = 0

  for (const queryTerm of intent.expandedTerms) {
    for (const signalTerm of signalTerms) {
      const lowerSignal = signalTerm.toLowerCase()
      if (lowerSignal === queryTerm) {
        matchScore += 2
      } else if (lowerSignal.includes(queryTerm) || queryTerm.includes(lowerSignal)) {
        matchScore += 1
      }
    }
  }

  return matchScore
}

export function inferKindFromQuery(query: string): string[] {
  const intent = extractQueryIntent(query)
  return intent.kindHints
}

export function inferFrameworkFromQuery(query: string): string[] {
  const intent = extractQueryIntent(query)
  return intent.frameworkHints
}