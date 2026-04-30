import { readdir, stat, readFile } from "fs/promises"
import path from "path"
import type { IgnoreRules } from "./ignore-rules.js"
import { shouldIgnoreFolder, isSupportedFile, createIgnoreRules } from "./ignore-rules.js"
import { createFileHasher, type FileHash } from "./file-hasher.js"
import { createEvidence } from "../types/index.js"

export interface ScanOptions {
  root: string
  force?: boolean
  include?: string[]
  exclude?: string[]
}

export interface ScanResult {
  filesScanned: number
  filesSkipped: number
  filesFailed: number
  filesUpToDate: number
  totalFiles: number
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
  signalsCreated: number
  signalsUpdated: number
  durationMs: number
  errors: string[]
}

export interface ScannedFile {
  path: string
  content: string
  hash: string
  size: number
  evidence: ReturnType<typeof createEvidence>
}

export interface FileState {
  path: string
  hash: string
  size: number
  mtimeMs: number
}

export class FileScanner {
  private rules: IgnoreRules
  private hasher = createFileHasher()
  private fileStateCache: Map<string, FileState> = new Map()

  constructor(rules?: IgnoreRules) {
    this.rules = rules ?? createIgnoreRules()
  }

  async scan(options: ScanOptions): Promise<ScanResult> {
    const startTime = Date.now()
    const result: ScanResult = {
      filesScanned: 0,
      filesSkipped: 0,
      filesFailed: 0,
      filesUpToDate: 0,
      totalFiles: 0,
      rawSourceChars: 0,
      signalChars: 0,
      storageReductionPercent: 0,
      signalsCreated: 0,
      signalsUpdated: 0,
      durationMs: 0,
      errors: [],
    }

    const files = await this.discoverFiles(options.root)
    result.totalFiles = files.length

    for (const file of files) {
      try {
        const previousState = this.fileStateCache.get(file)
        const fileHash = await this.hasher.computeHashWithMeta(file)

        if (!fileHash) {
          result.filesFailed++
          continue
        }

        if (!options.force && previousState && previousState.hash === fileHash.hash) {
          result.filesSkipped++
          result.filesUpToDate++
          continue
        }

        const content = await readFile(file, "utf-8")
        const evidence = createEvidence({
          sourceType: "file",
          file: path.relative(options.root, file),
          contentHash: fileHash.hash,
          rawSize: content.length,
        })

        result.rawSourceChars += content.length
        result.filesScanned++

        this.fileStateCache.set(file, {
          path: file,
          hash: fileHash.hash,
          size: fileHash.size,
          mtimeMs: fileHash.mtimeMs,
        })
      } catch (error) {
        result.filesFailed++
        result.errors.push(`Failed to scan ${file}: ${error}`)
      }
    }

    result.durationMs = Date.now() - startTime
    return result
  }

  async discoverFiles(root: string, relativeTo?: string): Promise<string[]> {
    const files: string[] = []
    const baseDir = relativeTo ?? root

    try {
      const entries = await readdir(root, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(root, entry.name)

        if (entry.isDirectory()) {
          if (!shouldIgnoreFolder(entry.name, this.rules)) {
            const subFiles = await this.discoverFiles(fullPath, baseDir)
            files.push(...subFiles)
          }
        } else if (entry.isFile() && isSupportedFile(entry.name, this.rules)) {
          files.push(fullPath)
        }
      }
    } catch {
      // Ignore permission errors
    }

    return files
  }

  async scanFile(filePath: string, worktree: string): Promise<ScannedFile | null> {
    try {
      const fileHash = await this.hasher.computeHashWithMeta(filePath)
      if (!fileHash) return null

      if (fileHash.size > this.rules.maxFileSizeBytes) {
        return null
      }

      const content = await readFile(filePath, "utf-8")
      const evidence = createEvidence({
        sourceType: "file",
        file: path.relative(worktree, filePath),
        contentHash: fileHash.hash,
        rawSize: content.length,
      })

      this.fileStateCache.set(filePath, {
        path: filePath,
        hash: fileHash.hash,
        size: fileHash.size,
        mtimeMs: fileHash.mtimeMs,
      })

      return {
        path: filePath,
        content,
        hash: fileHash.hash,
        size: fileHash.size,
        evidence,
      }
    } catch {
      return null
    }
  }

  async isFileChanged(filePath: string, previousHash: string): Promise<boolean> {
    return this.hasher.hasChanged(filePath, previousHash)
  }

  getFileState(filePath: string): FileState | undefined {
    return this.fileStateCache.get(filePath)
  }

  getRules(): IgnoreRules {
    return { ...this.rules }
  }

  clearCache(): void {
    this.fileStateCache.clear()
  }
}