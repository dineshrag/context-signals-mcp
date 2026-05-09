import crypto from "crypto"

export function createSignalId(file: string, symbol: string, line: number): string {
  const input = `${file}::${symbol}::${line}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createCallEdgeId(fromFile: string, fromSymbol: string, toRaw: string): string {
  const input = `${fromFile}::${fromSymbol}::${toRaw}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createImportEdgeId(fromFile: string, toFile: string): string {
  const input = `${fromFile}::${toFile}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createFileId(path: string, contentHash: string): string {
  const input = `${path}::${contentHash}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createBenchmarkRunId(project: string, timestamp: number): string {
  const input = `${project}::${timestamp}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}

export function createResultId(runId: string, queryId: string, baseline: string): string {
  const input = `${runId}::${queryId}::${baseline}`
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
}