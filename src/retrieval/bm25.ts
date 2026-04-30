import MiniSearch from "minisearch"

export interface Bm25Config {
  fields: string[]
  storeFields: string[]
  boost: Record<string, number>
  prefix: boolean
  fuzzy: number
}

export const DEFAULT_BM25_CONFIG: Bm25Config = {
  fields: ["text", "file", "name", "kind", "language", "tags"],
  storeFields: ["id", "evidenceId", "kind", "language", "file", "name", "text", "lineStart", "lineEnd", "confidence", "tags", "framework", "route"],
  boost: {
    name: 4,
    tags: 3,
    file: 2,
    kind: 2,
    text: 1,
  },
  prefix: true,
  fuzzy: 0.15,
}

export interface IndexedDocument {
  id: string
  evidenceId: string
  kind: string
  language?: string
  file?: string
  name?: string
  text: string
  lineStart?: number
  lineEnd?: number
  confidence: number
  tags: string[]
  framework?: string
  route?: { method?: string; path?: string; handler?: string }
}

export class Bm25Index {
  private miniSearch: MiniSearch<IndexedDocument>
  private config: Bm25Config

  constructor(config: Partial<Bm25Config> = {}) {
    this.config = { ...DEFAULT_BM25_CONFIG, ...config }
    this.miniSearch = new MiniSearch<IndexedDocument>({
      fields: this.config.fields,
      storeFields: this.config.storeFields,
      searchOptions: {
        boost: this.config.boost,
        prefix: this.config.prefix,
        fuzzy: this.config.fuzzy,
      },
    })
  }

  index(documents: IndexedDocument[]): void {
    this.miniSearch.addAll(documents)
  }

  add(document: IndexedDocument): void {
    this.miniSearch.add(document)
  }

  remove(id: string): void {
    this.miniSearch.discard(id)
  }

  query(queryStr: string, options?: { limit?: number; filter?: (doc: IndexedDocument) => boolean }): Bm25SearchResult[] {
    let results = this.miniSearch.search(queryStr)

    if (options?.filter) {
      results = results.filter(r => options.filter!(r as unknown as IndexedDocument))
    }

    const limited = results.slice(0, options?.limit ?? 10)

    return limited.map(r => ({
      id: r.id,
      score: Number(r.score?.toFixed(2) ?? r.score),
      document: r as unknown as IndexedDocument,
    }))
  }

  clear(): void {
    this.miniSearch = new MiniSearch<IndexedDocument>({
      fields: this.config.fields,
      storeFields: this.config.storeFields,
      searchOptions: {
        boost: this.config.boost,
        prefix: this.config.prefix,
        fuzzy: this.config.fuzzy,
      },
    })
  }

  getStats(): { documentCount: number; indexedFields: string[] } {
    return {
      documentCount: this.miniSearch.documentCount,
      indexedFields: this.config.fields,
    }
  }
}

export interface Bm25SearchResult {
  id: string
  score: number
  document: IndexedDocument
}

export function createBm25Index(config?: Partial<Bm25Config>): Bm25Index {
  return new Bm25Index(config)
}