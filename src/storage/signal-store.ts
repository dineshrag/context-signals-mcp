import { mkdir, readFile, writeFile, rm, stat } from "fs/promises"
import path from "path"
import { signalKey } from "../utils/signal-key.js"

export interface SignalRecord {
  id: string
  evidenceId: string
  sessionId?: string
  kind: string
  language?: string
  file?: string
  name?: string
  lineStart?: number
  lineEnd?: number
  framework?: string
  route?: { method?: string; path?: string; handler?: string }
  text: string
  tags: string[]
  confidence: number
  createdAt: number
  updatedAt?: number
}

export interface SignalStoreStats {
  count: number
  sizeBytes: number
  byKind: Record<string, number>
  byLanguage: Record<string, number>
  byFramework: Record<string, number>
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
}

export interface AddSignalsResult {
  signals: SignalRecord[]
  signalsCreated: number
  signalsUpdated: number
  totalChars: number
}

export class SignalStore {
  private signalsFile: string
  private cache: SignalRecord[] | null = null

  constructor(memoryDir: string) {
    this.signalsFile = path.join(memoryDir, "signals.json")
  }

  async load(): Promise<SignalRecord[]> {
    if (this.cache) return this.cache
    try {
      const content = await readFile(this.signalsFile, "utf-8")
      this.cache = JSON.parse(content) as SignalRecord[]
      return this.cache
    } catch {
      this.cache = []
      return this.cache
    }
  }

  async save(signals: SignalRecord[]): Promise<void> {
    await mkdir(path.dirname(this.signalsFile), { recursive: true })
    await writeFile(this.signalsFile, JSON.stringify(signals, null, 2), "utf-8")
    this.cache = signals
  }

  async addSignals(newSignals: SignalRecord[]): Promise<SignalRecord[]> {
    const result = await this.addSignalsWithStats(newSignals)
    return result.signals
  }

  async addSignalsWithStats(newSignals: SignalRecord[]): Promise<AddSignalsResult> {
    const existing = await this.load()
    const seen = new Set(existing.map(signalKey))
    const merged: SignalRecord[] = [...existing]
    let signalsCreated = 0
    let signalsUpdated = 0

    for (const signal of newSignals) {
      const key = signalKey(signal)
      if (seen.has(key)) {
        signalsUpdated++
        continue
      }
      seen.add(key)
      merged.push(signal)
      signalsCreated++
    }

    await this.save(merged)
    return {
      signals: merged,
      signalsCreated,
      signalsUpdated,
      totalChars: merged.reduce((sum, s) => sum + s.text.length, 0),
    }
  }

  async getByKind(kind: string): Promise<SignalRecord[]> {
    const signals = await this.load()
    return signals.filter(s => s.kind === kind)
  }

  async getByFile(file: string): Promise<SignalRecord[]> {
    const signals = await this.load()
    return signals.filter(s => s.file === file)
  }

  async getByFramework(framework: string): Promise<SignalRecord[]> {
    const signals = await this.load()
    return signals.filter(s => s.framework === framework)
  }

  async clear(): Promise<void> {
    await rm(this.signalsFile, { force: true })
    this.cache = null
  }

  async removeByFile(file: string): Promise<number> {
    const existing = await this.load()
    const before = existing.length
    const filtered = existing.filter(s => s.file !== file)
    const removed = before - filtered.length
    if (removed > 0) {
      await this.save(filtered)
    }
    return removed
  }

  async getStats(rawSourceChars = 0): Promise<SignalStoreStats> {
    const signals = await this.load()
    let sizeBytes = 0
    try {
      const stats = await stat(this.signalsFile)
      sizeBytes = stats.size
    } catch {}

    const byKind: Record<string, number> = {}
    const byLanguage: Record<string, number> = {}
    const byFramework: Record<string, number> = {}
    let signalChars = 0

    for (const s of signals) {
      byKind[s.kind] = (byKind[s.kind] ?? 0) + 1
      if (s.language) byLanguage[s.language] = (byLanguage[s.language] ?? 0) + 1
      if (s.framework) byFramework[s.framework] = (byFramework[s.framework] ?? 0) + 1
      signalChars += s.text.length
    }

    const storageReductionPercent = rawSourceChars > 0
      ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
      : 0

    return {
      count: signals.length,
      sizeBytes,
      byKind,
      byLanguage,
      byFramework,
      rawSourceChars,
      signalChars,
      storageReductionPercent,
    }
  }

  private async write(signals: SignalRecord[]): Promise<void> {
    await mkdir(path.dirname(this.signalsFile), { recursive: true })
    await writeFile(this.signalsFile, JSON.stringify(signals, null, 2), "utf-8")
    this.cache = signals
  }
}