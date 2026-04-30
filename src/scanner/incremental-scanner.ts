import { readdir, stat, readFile } from "fs/promises"
import path from "path"
import { createHash } from "crypto"
import { shouldIgnoreFolder, isSupportedFile, createIgnoreRules } from "./ignore-rules.js"
import { createFileHasher } from "./file-hasher.js"
import { createEvidence } from "../types/index.js"
import { IndexStore, type FileMeta, type PerFileIndexMeta } from "../storage/index-store.js"

export interface IncrementalScanOptions {
  root: string
  force?: boolean
  include?: string[]
  exclude?: string[]
}

export interface IncrementalScanResult {
  filesToIndex: string[]
  filesToRemove: string[]
  filesUnchanged: string[]
  totalFiles: number
  durationMs: number
  errors: string[]
}

export class IncrementalScanner {
  private indexStore: IndexStore
  private hasher = createFileHasher()

  constructor(indexStore: IndexStore) {
    this.indexStore = indexStore
  }

  async scan(options: IncrementalScanOptions): Promise<IncrementalScanResult> {
    const startTime = Date.now()
    const result: IncrementalScanResult = {
      filesToIndex: [],
      filesToRemove: [],
      filesUnchanged: [],
      totalFiles: 0,
      durationMs: 0,
      errors: [],
    }

    const currentFiles = await this.discoverFiles(options.root)
    result.totalFiles = currentFiles.length

    const previousMeta = await this.indexStore.loadPerFileMeta()
    const previousFiles = previousMeta ? new Set(Object.keys(previousMeta.files)) : new Set<string>()
    const currentFilesSet = new Set(currentFiles)

    for (const file of currentFiles) {
      try {
        const fileStat = await stat(file)
        const currentMtime = fileStat.mtime.toISOString()
        const previousFileMeta = previousMeta?.files[file]

        if (!previousFileMeta) {
          result.filesToIndex.push(file)
        } else if (currentMtime === previousFileMeta.mtime) {
          result.filesUnchanged.push(file)
        } else {
          const currentHash = await this.computeContentHash(file)
          if (currentHash !== previousFileMeta.hash) {
            result.filesToIndex.push(file)
          } else {
            result.filesUnchanged.push(file)
          }
        }
      } catch (error) {
        result.errors.push(`Failed to scan ${file}: ${error}`)
      }
    }

    for (const oldFile of previousFiles) {
      if (!currentFilesSet.has(oldFile)) {
        result.filesToRemove.push(oldFile)
      }
    }

    if (options.force) {
      result.filesToIndex = currentFiles
      result.filesUnchanged = []
      result.filesToRemove = []
    }

    result.durationMs = Date.now() - startTime
    return result
  }

  async getFilesToIndex(options: IncrementalScanOptions): Promise<{ file: string, content: string, meta: FileMeta, evidence: ReturnType<typeof createEvidence> }[]> {
    const scanResult = await this.scan(options)
    const results: { file: string, content: string, meta: FileMeta, evidence: ReturnType<typeof createEvidence> }[] = []

    const root = options.root

    for (const file of scanResult.filesToIndex) {
      try {
        const content = await readFile(file, "utf-8")
        const fileStat = await stat(file)
        const hash = await this.computeContentHash(file)

        const meta: FileMeta = {
          mtime: fileStat.mtime.toISOString(),
          hash: hash,
          indexedAt: new Date().toISOString(),
        }

        const evidence = createEvidence({
          sourceType: "file",
          file: path.relative(root, file),
          contentHash: hash,
          rawSize: content.length,
        })

        results.push({ file, content, meta, evidence })
      } catch (error) {
        scanResult.errors.push(`Failed to read ${file}: ${error}`)
      }
    }

    return results
  }

  async updateMetaForFile(file: string, meta: FileMeta): Promise<void> {
    await this.indexStore.updateFileMeta(file, meta)
  }

  async removeMetaForFile(file: string): Promise<void> {
    await this.indexStore.removeFileMeta(file)
  }

  async removeMetaForFiles(files: string[]): Promise<void> {
    for (const file of files) {
      await this.indexStore.removeFileMeta(file)
    }
  }

  async saveFullMeta(files: Map<string, FileMeta>): Promise<void> {
    const meta: PerFileIndexMeta = {
      version: "1.1",
      lastFullScan: new Date().toISOString(),
      files: Object.fromEntries(files),
    }
    await this.indexStore.savePerFileMeta(meta)
  }

  async hasExistingMeta(): Promise<boolean> {
    return this.indexStore.hasPerFileMeta()
  }

  private async discoverFiles(root: string): Promise<string[]> {
    const files: string[] = []
    const rules = createIgnoreRules()

    const scanDir = async (dir: string): Promise<void> => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            if (!shouldIgnoreFolder(entry.name, rules)) {
              await scanDir(fullPath)
            }
          } else if (entry.isFile() && isSupportedFile(entry.name, rules)) {
            files.push(fullPath)
          }
        }
      } catch {
        // Ignore permission errors
      }
    }

    await scanDir(root)
    return files
  }

  private async computeContentHash(file: string): Promise<string> {
    try {
      const content = await readFile(file)
      return createHash("sha256").update(content).digest("hex")
    } catch {
      return ""
    }
  }
}
