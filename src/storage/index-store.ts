import { mkdir, readFile, writeFile, rm, stat } from "fs/promises"
import path from "path"

export interface IndexMetadata {
  lastIndexedAt: number
  totalFiles: number
  totalSignals: number
  rawSourceChars: number
  signalChars: number
  version: string
}

export class IndexStore {
  private metadataFile: string
  private cache: IndexMetadata | null = null

  constructor(memoryDir: string) {
    this.metadataFile = path.join(memoryDir, "index-meta.json")
  }

  async load(): Promise<IndexMetadata | null> {
    if (this.cache) return this.cache
    try {
      const content = await readFile(this.metadataFile, "utf-8")
      this.cache = JSON.parse(content) as IndexMetadata
      return this.cache
    } catch {
      return null
    }
  }

  async save(metadata: IndexMetadata): Promise<void> {
    await mkdir(path.dirname(this.metadataFile), { recursive: true })
    await writeFile(this.metadataFile, JSON.stringify(metadata, null, 2), "utf-8")
    this.cache = metadata
  }

  async update(partial: Partial<IndexMetadata>): Promise<IndexMetadata> {
    const current = await this.load() ?? {
      lastIndexedAt: 0,
      totalFiles: 0,
      totalSignals: 0,
      rawSourceChars: 0,
      signalChars: 0,
      version: "1.0.0",
    }
    const updated = { ...current, ...partial }
    await this.save(updated)
    return updated
  }

  async clear(): Promise<void> {
    await rm(this.metadataFile, { force: true })
    this.cache = null
  }

  async getStorageSize(): Promise<number> {
    try {
      const stats = await stat(this.metadataFile)
      return stats.size
    } catch {
      return 0
    }
  }
}