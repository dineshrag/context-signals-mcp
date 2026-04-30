import type { Config } from "../config.js"
import type { Signal } from "../types/signal.js"

export interface ScanInput {
  extensions?: string[]
  exclude?: string[]
  force?: boolean
}

export interface ScanOutput {
  filesScanned: number
  filesSkipped: number
  signalsCreated: number
  signalsUpdated: number
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
  durationMs: number
  errors: string[]
}

export async function handleScan(
  input: ScanInput,
  context: {
    config: Config
    scanner: any
    evidenceStore: any
    signalStore: any
    indexStore: any
    extractSignals: (evidence: any) => Signal[]
  }
): Promise<ScanOutput> {
  const { config, scanner, evidenceStore, signalStore, indexStore, extractSignals } = context

  const force = input.force ?? false
  const exclude = input.exclude ?? ["node_modules", "dist", "build", ".next", ".git"]

  const startTime = Date.now()
  let filesScanned = 0
  let filesSkipped = 0
  let signalsCreated = 0
  let signalsUpdated = 0
  let rawSourceChars = 0
  let signalChars = 0
  const errors: string[] = []

  const files = await scanner.discoverFiles(config.worktree)

  for (const file of files) {
    try {
      const scanned = await scanner.scanFile(file, config.worktree)
      if (!scanned) {
        filesSkipped++
        continue
      }

      await evidenceStore.save(scanned.evidence)

      const evidence: any = {
        id: crypto.randomUUID(),
        sessionId: "scan",
        tool: "scan",
        input: { file: scanned.path },
        output: scanned.content,
        createdAt: Date.now(),
      }

      const signals = extractSignals(evidence)
      const result = await signalStore.addSignalsWithStats(signals)

      filesScanned++
      signalsCreated += result.signalsCreated
      signalsUpdated += result.signalsUpdated
      rawSourceChars += scanned.content.length
      signalChars += result.totalChars
    } catch (error) {
      errors.push(`Failed to process ${file}: ${error}`)
    }
  }

  const storageReductionPercent = rawSourceChars > 0
    ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
    : 0

  await indexStore.update({
    lastIndexedAt: Date.now(),
    totalFiles: files.length,
    totalSignals: signalsCreated,
    rawSourceChars,
    signalChars,
  })

  const durationMs = Date.now() - startTime

  return {
    filesScanned,
    filesSkipped,
    signalsCreated,
    signalsUpdated,
    rawSourceChars,
    signalChars,
    storageReductionPercent,
    durationMs,
    errors: errors.slice(0, 10),
  }
}