import { createHash } from "crypto"
import { readFile } from "fs/promises"

export interface FileHash {
  file: string
  hash: string
  size: number
  mtimeMs: number
}

export interface FileHasher {
  computeHash(file: string): Promise<string | null>
  computeHashWithMeta(file: string): Promise<FileHash | null>
  hasChanged(file: string, previousHash: string): Promise<boolean>
}

export function createFileHasher(): FileHasher {
  async function computeHash(file: string): Promise<string | null> {
    try {
      const content = await readFile(file)
      return createHash("sha256").update(content).digest("hex")
    } catch {
      return null
    }
  }

  async function computeHashWithMeta(file: string): Promise<FileHash | null> {
    try {
      const content = await readFile(file)
      const stat = await import("fs/promises").then(m => m.stat(file))
      const hash = createHash("sha256").update(content).digest("hex")
      return {
        file,
        hash,
        size: stat.size,
        mtimeMs: stat.mtimeMs,
      }
    } catch {
      return null
    }
  }

  async function hasChanged(file: string, previousHash: string): Promise<boolean> {
    const currentHash = await computeHash(file)
    return currentHash !== previousHash
  }

  return { computeHash, computeHashWithMeta, hasChanged }
}