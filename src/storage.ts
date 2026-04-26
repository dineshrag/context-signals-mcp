import { mkdir, readFile, writeFile } from "fs/promises"
import path from "path"
import type { Signal, Evidence } from "./extractor.js"

export type StorageConfig = {
  memoryDir: string
  worktree: string
}

export class SignalStorage {
  private memoryDir: string
  private evidenceFile: string
  private signalsFile: string

  constructor(config: StorageConfig) {
    this.memoryDir = config.memoryDir
    this.evidenceFile = path.join(this.memoryDir, "evidence.json")
    this.signalsFile = path.join(this.memoryDir, "signals.json")
  }

  async loadEvidence(): Promise<Evidence[]> {
    return this.loadJson<Evidence[]>(this.evidenceFile, [])
  }

  async saveEvidence(evidence: Evidence): Promise<void> {
    const list = await this.loadEvidence()
    list.push(evidence)
    await this.saveJson(this.evidenceFile, list)
  }

  async loadSignals(): Promise<Signal[]> {
    return this.loadJson<Signal[]>(this.signalsFile, [])
  }

  async saveSignals(signals: Signal[]): Promise<void> {
    await this.saveJson(this.signalsFile, signals)
  }

  async addSignals(newSignals: Signal[]): Promise<Signal[]> {
    const existing = await this.loadSignals()
    const seen = new Set(existing.map(signalKey))
    const merged: Signal[] = [...existing]

    for (const signal of newSignals) {
      const key = signalKey(signal)
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(signal)
    }

    await this.saveSignals(merged)
    return merged
  }

  async clear(): Promise<void> {
    const { unlink, rm } = await import("fs/promises")
    try {
      await rm(this.memoryDir, { recursive: true, force: true })
    } catch {
      // Ignore errors
    }
  }

  async getStats(): Promise<{
    evidenceCount: number
    signalCount: number
    storageUsed: number
  }> {
    const [evidence, signals] = await Promise.all([
      this.loadEvidence(),
      this.loadSignals(),
    ])

    let storageUsed = 0
    try {
      const { stat } = await import("fs/promises")
      const evidenceStat = await stat(this.evidenceFile)
      const signalsStat = await stat(this.signalsFile)
      storageUsed = evidenceStat.size + signalsStat.size
    } catch {
      // Ignore
    }

    return {
      evidenceCount: evidence.length,
      signalCount: signals.length,
      storageUsed,
    }
  }

  private async loadJson<T>(file: string, fallback: T): Promise<T> {
    try {
      return JSON.parse(await readFile(file, "utf-8")) as T
    } catch {
      return fallback
    }
  }

  private async saveJson(file: string, data: unknown): Promise<void> {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, JSON.stringify(data, null, 2), "utf-8")
  }
}

function signalKey(signal: Signal): string {
  return [
    signal.kind,
    signal.file ?? "",
    signal.name ?? "",
    signal.lineStart ?? "",
    signal.text,
  ].join("|")
}