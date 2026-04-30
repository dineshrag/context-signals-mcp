export interface ClearOutput {
  message: string
}

export async function handleClear(
  context: {
    signalStore: any
    evidenceStore: any
    indexStore: any
    scanner: any
  }
): Promise<ClearOutput> {
  const { signalStore, evidenceStore, indexStore, scanner } = context

  await signalStore.clear()
  await evidenceStore.clear()
  await indexStore.clear()
  scanner.clearCache()

  return {
    message: "All signals cleared",
  }
}