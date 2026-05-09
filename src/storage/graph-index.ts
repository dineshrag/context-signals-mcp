import type { CallEdge, ImportEdge } from "./sql-store.js"

export class GraphIndex {
  private symbolToCalls: Map<string, CallEdge[]> = new Map()
  private fileToImports: Map<string, ImportEdge[]> = new Map()
  private fileToExports: Map<string, ImportEdge[]> = new Map()
  private symbolToDefFile: Map<string, string> = new Map()

  indexCallEdges(edges: CallEdge[]): void {
    for (const edge of edges) {
      const key = this.normalizeSymbol(edge.toRaw)
      if (!this.symbolToCalls.has(key)) {
        this.symbolToCalls.set(key, [])
      }
      this.symbolToCalls.get(key)!.push(edge)

      const fromKey = `${edge.fromFile}::${edge.fromSymbol}`
      this.symbolToDefFile.set(fromKey, edge.fromFile)
    }
  }

  indexImportEdges(edges: ImportEdge[]): void {
    for (const edge of edges) {
      if (!this.fileToImports.has(edge.fromFile)) {
        this.fileToImports.set(edge.fromFile, [])
      }
      this.fileToImports.get(edge.fromFile)!.push(edge)

      if (!this.fileToExports.has(edge.toFile)) {
        this.fileToExports.set(edge.toFile, [])
      }
      this.fileToExports.get(edge.toFile)!.push(edge)

      this.symbolToDefFile.set(edge.modulePath, edge.toFile)
    }
  }

  getCallsTo(symbol: string): CallEdge[] {
    const key = this.normalizeSymbol(symbol)
    return this.symbolToCalls.get(key) ?? []
  }

  getCallsFrom(file: string, symbol: string): CallEdge[] {
    const key = `${file}::${symbol}`
    const defFile = this.symbolToDefFile.get(key)
    if (!defFile) return []

    const results: CallEdge[] = []
    for (const [sym, calls] of this.symbolToCalls) {
      for (const call of calls) {
        if (call.fromFile === file && call.fromSymbol === symbol) {
          results.push(call)
        }
      }
    }
    return results
  }

  getImportsTo(file: string): ImportEdge[] {
    const results: ImportEdge[] = []
    for (const [f, edges] of this.fileToImports) {
      if (f === file) continue
      for (const edge of edges) {
        if (this.pathMatches(edge.toFile, file)) {
          results.push(edge)
        }
      }
    }
    return results
  }

  getImportsFrom(file: string): ImportEdge[] {
    return this.fileToImports.get(file) ?? []
  }

  getExportsFrom(file: string): ImportEdge[] {
    return this.fileToExports.get(file) ?? []
  }

  resolveSymbol(symbol: string): string | null {
    const key = this.normalizeSymbol(symbol)
    const calls = this.symbolToCalls.get(key)
    if (calls && calls.length > 0 && calls[0].toResolved) {
      return calls[0].toResolved
    }
    return null
  }

  clear(): void {
    this.symbolToCalls.clear()
    this.fileToImports.clear()
    this.fileToExports.clear()
    this.symbolToDefFile.clear()
  }

  private normalizeSymbol(symbol: string): string {
    return symbol.toLowerCase().replace(/\s+/g, "")
  }

  private pathMatches(pattern: string, target: string): boolean {
    const nPattern = pattern.replace(/\\/g, "/").toLowerCase()
    const nTarget = target.replace(/\\/g, "/").toLowerCase()
    return nTarget.includes(nPattern) || nPattern.includes(nTarget)
  }
}