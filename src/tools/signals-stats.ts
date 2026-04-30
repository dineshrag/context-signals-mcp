export interface StatsOutput {
  filesIndexed: number
  signals: number
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
  byKind: Record<string, number>
  byLanguage: Record<string, number>
  byFramework: Record<string, number>
  lsp?: {
    enabled: boolean
    available: boolean
    reason?: string
  }
}

export async function handleStats(
  context: {
    signalStore: any
    indexStore: any
  }
): Promise<StatsOutput> {
  const { signalStore, indexStore } = context

  const indexMeta = await indexStore.load()
  const rawSourceChars = indexMeta?.rawSourceChars ?? 0
  const stats = await signalStore.getStats(rawSourceChars)

  return {
    filesIndexed: indexMeta?.totalFiles ?? 0,
    signals: stats.count,
    rawSourceChars: stats.rawSourceChars,
    signalChars: stats.signalChars,
    storageReductionPercent: stats.storageReductionPercent,
    byKind: stats.byKind,
    byLanguage: stats.byLanguage,
    byFramework: stats.byFramework,
  }
}