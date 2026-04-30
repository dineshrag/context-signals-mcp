import type { Config } from "../config.js"
import type { Signal } from "../types/signal.js"
import type { IncrementalScanner } from "../scanner/incremental-scanner.js"
import type { IndexStore } from "../storage/index-store.js"

export interface ScanInput {
  extensions?: string[]
  exclude?: string[]
  force?: boolean
}

export interface ScanOutput {
  filesScanned: number
  filesSkipped: number
  filesRemoved: number
  signalsCreated: number
  signalsUpdated: number
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
  durationMs: number
  scanMode: "full" | "incremental"
  errors: string[]
}

export async function handleScan(
  input: ScanInput,
  context: {
    config: Config
    scanner: any
    evidenceStore: any
    signalStore: any
    indexStore: IndexStore
    incrementalScanner: IncrementalScanner
    extractSignals: (evidence: any) => Signal[]
  }
): Promise<ScanOutput> {
  const { config, evidenceStore, signalStore, indexStore, incrementalScanner, extractSignals } = context

  const force = input.force ?? false
  const exclude = input.exclude ?? ["node_modules", "dist", "build", ".next", ".git"]

  const startTime = Date.now()
  let filesScanned = 0
  let filesSkipped = 0
  let filesRemoved = 0
  let signalsCreated = 0
  let signalsUpdated = 0
  let rawSourceChars = 0
  let signalChars = 0
  const errors: string[] = []

  const scanOptions = {
    root: config.worktree,
    force,
    exclude,
  }

  const scanResult = await incrementalScanner.scan(scanOptions)
  const hasExistingMeta = await incrementalScanner.hasExistingMeta()

  if (!hasExistingMeta && !force) {
    filesSkipped = scanResult.totalFiles
    return {
      filesScanned: 0,
      filesSkipped,
      filesRemoved: 0,
      signalsCreated: 0,
      signalsUpdated: 0,
      rawSourceChars: 0,
      signalChars: 0,
      storageReductionPercent: 0,
      durationMs: Date.now() - startTime,
      scanMode: "incremental",
      errors: ["No existing index metadata found. Run with force:true to perform full scan."],
    }
  }

  for (const file of scanResult.filesToRemove) {
    await incrementalScanner.removeMetaForFile(file)
    const fileSignals = await signalStore.getByFile(file)
    if (fileSignals.length > 0) {
const allSignals = await signalStore.load()
          const filtered = allSignals.filter((s: { file?: string }) => s.file !== file)
      await signalStore.save(filtered)
      filesRemoved++
    }
  }

  const filesToProcess = await incrementalScanner.getFilesToIndex(scanOptions)

  for (const { file, content, meta, evidence } of filesToProcess) {
    try {
      await evidenceStore.save(evidence)

      const evidenceData: any = {
        id: crypto.randomUUID(),
        sessionId: "scan",
        tool: "scan",
        input: { file },
        output: content,
        createdAt: Date.now(),
      }

      const signals = extractSignals(evidenceData)
      const result = await signalStore.addSignalsWithStats(signals)

      await incrementalScanner.updateMetaForFile(file, meta)

      filesScanned++
      signalsCreated += result.signalsCreated
      signalsUpdated += result.signalsUpdated
      rawSourceChars += content.length
      signalChars += result.totalChars
    } catch (error) {
      errors.push(`Failed to process ${file}: ${error}`)
    }
  }

  filesSkipped = scanResult.filesUnchanged.length

  const storageReductionPercent = rawSourceChars > 0
    ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
    : 0

  await indexStore.update({
    lastIndexedAt: Date.now(),
    totalFiles: scanResult.totalFiles,
    totalSignals: signalsCreated,
    rawSourceChars,
    signalChars,
  })

  const durationMs = Date.now() - startTime

  return {
    filesScanned,
    filesSkipped,
    filesRemoved,
    signalsCreated,
    signalsUpdated,
    rawSourceChars,
    signalChars,
    storageReductionPercent,
    durationMs,
    scanMode: force ? "full" : "incremental",
    errors: errors.slice(0, 10),
  }
}