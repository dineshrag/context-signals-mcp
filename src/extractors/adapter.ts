import type { Signal } from "../types/signal.js"
import type { CallEdge, ImportEdge } from "../storage/sql-store.js"

export interface ExtractResult {
  signals: Signal[]
  calls: CallEdge[]
  imports: ImportEdge[]
  errors: string[]
  language: string
}

export interface LanguageAdapter {
  language: string

  canExtract(file: string): boolean

  extract(content: string, file: string): Promise<ExtractResult>

  init?(): Promise<void>

  destroy?(): void
}

export interface FrameworkHint {
  framework: string
  confidence: number
}

export interface AdapterRegistryOptions {
  pythonWorkerPath?: string
}

export class AdapterRegistry {
  private adapters: Map<string, LanguageAdapter> = new Map()
  private fileToAdapter: Map<string, LanguageAdapter> = new Map()
  private options: AdapterRegistryOptions

  constructor(options: AdapterRegistryOptions = {}) {
    this.options = options
  }

  register(adapter: LanguageAdapter): void {
    this.adapters.set(adapter.language, adapter)

    if (adapter.init) {
      adapter.init()
    }
  }

  get(file: string): LanguageAdapter | null {
    const ext = file.slice(file.lastIndexOf(".")).toLowerCase()

    if (ext === ".py") {
      return this.adapters.get("python") ?? null
    }

    if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      return this.adapters.get("typescript") ?? this.adapters.get("javascript") ?? null
    }

    return null
  }

  detectLanguage(file: string): string | null {
    const adapter = this.get(file)
    return adapter?.language ?? null
  }

  getAdapter(language: string): LanguageAdapter | null {
    return this.adapters.get(language) ?? null
  }

  async extract(content: string, file: string): Promise<ExtractResult> {
    const adapter = this.get(file)
    if (!adapter) {
      return { signals: [], calls: [], imports: [], errors: ["No adapter for file type"], language: "unknown" }
    }

    return adapter.extract(content, file)
  }

  listLanguages(): string[] {
    return Array.from(this.adapters.keys())
  }

  destroy(): void {
    for (const adapter of this.adapters.values()) {
      if (adapter.destroy) {
        adapter.destroy()
      }
    }
    this.adapters.clear()
    this.fileToAdapter.clear()
  }
}

export function createAdapterRegistry(options?: AdapterRegistryOptions): AdapterRegistry {
  return new AdapterRegistry(options)
}