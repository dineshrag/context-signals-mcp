export type EvidenceSourceType = "file" | "lsp" | "tool"

export interface Evidence {
  id: string
  sourceType: EvidenceSourceType
  file?: string
  contentHash?: string
  rawSize: number
  createdAt: number
  metadata?: Record<string, unknown>
}

export function createEvidence(data: Partial<Evidence> & { sourceType: EvidenceSourceType }): Evidence {
  return {
    id: crypto.randomUUID(),
    sourceType: data.sourceType,
    file: data.file,
    contentHash: data.contentHash,
    rawSize: data.rawSize ?? 0,
    createdAt: data.createdAt ?? Date.now(),
    metadata: data.metadata,
  }
}