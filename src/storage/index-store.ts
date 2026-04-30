import { mkdir, readFile, writeFile, rm, stat } from "fs/promises"
import path from "path"

export interface FileMeta {
  mtime: string
  hash: string
  indexedAt: string
}

export interface IndexMetadata {
  lastIndexedAt: number
  totalFiles: number
  totalSignals: number
  rawSourceChars: number
  signalChars: number
  version: string
}

export interface PerFileIndexMeta {
  version: string
  lastFullScan: string
  files: Record<string, FileMeta>
}

export class IndexStore {
  private metadataFile: string
  private perFileMetaFile: string
  private cache: IndexMetadata | null = null
  private perFileCache: PerFileIndexMeta | null = null

  constructor(memoryDir: string) {
    this.metadataFile = path.join(memoryDir, "index-meta.json")
    this.perFileMetaFile = path.join(memoryDir, "file-meta.json")
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

  async loadPerFileMeta(): Promise<PerFileIndexMeta | null> {
    if (this.perFileCache) return this.perFileCache
    try {
      const content = await readFile(this.perFileMetaFile, "utf-8")
      this.perFileCache = JSON.parse(content) as PerFileIndexMeta
      return this.perFileCache
    } catch {
      return null
    }
  }

  async savePerFileMeta(meta: PerFileIndexMeta): Promise<void> {
    await mkdir(path.dirname(this.perFileMetaFile), { recursive: true })
    await writeFile(this.perFileMetaFile, JSON.stringify(meta, null, 2), "utf-8")
    this.perFileCache = meta
  }

  async updateFileMeta(filePath: string, fileMeta: FileMeta): Promise<PerFileIndexMeta> {
    const meta = await this.loadPerFileMeta() ?? this.createEmptyPerFileMeta()
    meta.files[filePath] = fileMeta
    await this.savePerFileMeta(meta)
    return meta
  }

  async removeFileMeta(filePath: string): Promise<PerFileIndexMeta | null> {
    const meta = await this.loadPerFileMeta()
    if (!meta) return null
    delete meta.files[filePath]
    await this.savePerFileMeta(meta)
    return meta
  }

  async getFileMeta(filePath: string): Promise<FileMeta | null> {
    const meta = await this.loadPerFileMeta()
    return meta?.files[filePath] ?? null
  }

  async clearPerFileMeta(): Promise<void> {
    await rm(this.perFileMetaFile, { force: true })
    this.perFileCache = null
  }

  createEmptyPerFileMeta(): PerFileIndexMeta {
    return {
      version: "1.1",
      lastFullScan: new Date().toISOString(),
      files: {}
    }
  }

  async getAllFilePaths(): Promise<string[]> {
    const meta = await this.loadPerFileMeta()
    return meta ? Object.keys(meta.files) : []
  }

  async hasPerFileMeta(): Promise<boolean> {
    const meta = await this.loadPerFileMeta()
    return meta !== null && Object.keys(meta.files).length > 0
  }
}