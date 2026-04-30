import { mkdir, readFile, writeFile, rm } from "fs/promises"
import path from "path"
import type { Evidence } from "../types/index.js"
import { createEvidence } from "../types/index.js"

export class EvidenceStore {
  private evidenceFile: string
  private cache: Evidence[] | null = null

  constructor(memoryDir: string) {
    this.evidenceFile = path.join(memoryDir, "evidence.json")
  }

  async load(): Promise<Evidence[]> {
    if (this.cache) return this.cache
    try {
      const content = await readFile(this.evidenceFile, "utf-8")
      this.cache = JSON.parse(content) as Evidence[]
      return this.cache
    } catch {
      this.cache = []
      return this.cache
    }
  }

  async save(evidence: Evidence): Promise<void> {
    const list = await this.load()
    list.push(evidence)
    await this.write(list)
  }

  async getById(id: string): Promise<Evidence | null> {
    const list = await this.load()
    return list.find(e => e.id === id) ?? null
  }

  async clear(): Promise<void> {
    await rm(this.evidenceFile, { force: true })
    this.cache = null
  }

  private async write(evidence: Evidence[]): Promise<void> {
    await mkdir(path.dirname(this.evidenceFile), { recursive: true })
    await writeFile(this.evidenceFile, JSON.stringify(evidence, null, 2), "utf-8")
    this.cache = evidence
  }
}