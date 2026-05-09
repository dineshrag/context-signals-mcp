import initSqlJs, { Database } from "sql.js"
import fs from "fs"
import path from "path"
import { createSignalId, createCallEdgeId, createImportEdgeId, createFileId, createBenchmarkRunId, createResultId } from "../utils/signal-id.js"
import type { Signal } from "../types/signal.js"

export type EdgeType = "static" | "inferred" | "dynamic"
export type ImportKind = "import" | "require" | "from" | "dynamic"

export interface CallEdge {
  id: string
  fromFile: string
  fromSymbol: string
  fromLine: number
  toRaw: string
  toResolved?: string
  confidence: number
  edgeType: EdgeType
  text: string
  line: number
  createdAt: number
}

export interface ImportEdge {
  id: string
  fromFile: string
  toFile: string
  modulePath: string
  importedSymbols: string[]
  importKind: ImportKind
  confidence: number
  edgeType: EdgeType
  line: number
  createdAt: number
}

export interface FileRecord {
  path: string
  contentHash: string
  language: string
  sizeBytes: number
  lastScanAt: number
}

export interface BenchmarkRun {
  id: string
  project: string
  repoUrl?: string
  commitSha?: string
  nodeVersion?: string
  pythonVersion?: string
  os?: string
  startedAt: number
  completedAt?: number
  queryCount?: number
  status: "running" | "completed" | "failed"
}

export interface BenchmarkQuery {
  id: string
  runId: string
  queryId: string
  queryText: string
  queryType: "simple" | "multi-hop" | "architectural" | "failure-case"
  expectedKind?: string
  expectedFramework?: string
  expectedMethod?: string
  expectedPath?: string
  fileContains?: string
  requiresLine: boolean
}

export interface BenchmarkResult {
  id: string
  runId: string
  queryId: string
  baseline: "grep" | "bm25" | "context-signals"
  top3Hit: boolean
  charsRead: number
  latencyMs: number
  scoreJson?: string
  retrievedIdsJson?: string
  createdAt: number
}

export interface RetrievalArtifact {
  id: string
  runId: string
  queryId: string
  baseline: string
  artifactType: "query" | "retrieved" | "scores" | "graph-paths" | "metadata"
  filePath: string
  createdAt: number
}

export interface StoreStats {
  signalCount: number
  callEdgeCount: number
  importEdgeCount: number
  fileCount: number
  rawSourceChars: number
  signalChars: number
  storageReductionPercent: number
  byKind: Record<string, number>
  byLanguage: Record<string, number>
  byFramework: Record<string, number>
}

export class SqlStore {
  private db: Database | null = null
  private dbPath: string
  private initialized = false

  constructor(dbPath: string = ".crush-memory/context-signals.db") {
    this.dbPath = dbPath
  }

  async init(): Promise<void> {
    if (this.initialized) return

    const SQL = await initSqlJs()

    const dir = path.dirname(this.dbPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath)
      this.db = new SQL.Database(buffer)
    } else {
      this.db = new SQL.Database()
      this.createTables()
    }

    this.initialized = true
  }

  private createTables(): void {
    if (!this.db) return

    this.db.run(`
      CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        evidence_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        language TEXT NOT NULL,
        file TEXT NOT NULL,
        name TEXT,
        line_start INTEGER,
        line_end INTEGER,
        framework TEXT,
        route_method TEXT,
        route_path TEXT,
        route_handler TEXT,
        text TEXT NOT NULL,
        tags_json TEXT,
        confidence REAL DEFAULT 0.8,
        content_hash TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_signals_kind ON signals(kind)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_signals_language ON signals(language)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_signals_file ON signals(file)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_signals_name ON signals(name)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_signals_framework ON signals(framework)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS call_edges (
        id TEXT PRIMARY KEY,
        from_file TEXT NOT NULL,
        from_symbol TEXT NOT NULL,
        from_line INTEGER NOT NULL,
        to_raw TEXT NOT NULL,
        to_resolved TEXT,
        confidence REAL DEFAULT 0.5,
        edge_type TEXT DEFAULT 'static',
        text TEXT NOT NULL,
        line INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_call_edges_to_raw ON call_edges(to_raw)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_call_edges_from_file ON call_edges(from_file)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_call_edges_from_symbol ON call_edges(from_symbol)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS import_edges (
        id TEXT PRIMARY KEY,
        from_file TEXT NOT NULL,
        to_file TEXT NOT NULL,
        module_path TEXT NOT NULL,
        imported_symbols_json TEXT,
        import_kind TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        edge_type TEXT DEFAULT 'static',
        line INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `)

    this.db.run(`CREATE INDEX IF NOT EXISTS idx_import_edges_to_file ON import_edges(to_file)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_import_edges_from_file ON import_edges(from_file)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS files (
        path TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        language TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        last_scan_at INTEGER NOT NULL
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS benchmark_runs (
        id TEXT PRIMARY KEY,
        project TEXT NOT NULL,
        repo_url TEXT,
        commit_sha TEXT,
        node_version TEXT,
        python_version TEXT,
        os TEXT,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        query_count INTEGER,
        status TEXT DEFAULT 'running'
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS benchmark_queries (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        query_text TEXT NOT NULL,
        query_type TEXT NOT NULL,
        expected_kind TEXT,
        expected_framework TEXT,
        expected_method TEXT,
        expected_path TEXT,
        file_contains TEXT,
        requires_line INTEGER DEFAULT 0,
        FOREIGN KEY (run_id) REFERENCES benchmark_runs(id)
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS benchmark_results (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        baseline TEXT NOT NULL,
        top3_hit INTEGER DEFAULT 0,
        chars_read INTEGER DEFAULT 0,
        latency_ms INTEGER DEFAULT 0,
        score_json TEXT,
        retrieved_ids_json TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (run_id) REFERENCES benchmark_runs(id)
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS retrieval_artifacts (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        query_id TEXT NOT NULL,
        baseline TEXT NOT NULL,
        artifact_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (run_id) REFERENCES benchmark_runs(id)
      )
    `)
  }

  async save(): Promise<void> {
    if (!this.db) return
    const data = this.db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(this.dbPath, buffer)
  }

  async insertSignal(signal: Signal): Promise<void> {
    if (!this.db) return

    const id = signal.id || createSignalId(signal.file, signal.name ?? signal.text, signal.lineStart ?? 0)

    this.db.run(
      `INSERT OR REPLACE INTO signals (id, evidence_id, kind, language, file, name, line_start, line_end,
       framework, route_method, route_path, route_handler, text, tags_json, confidence, content_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        signal.evidenceId,
        signal.kind,
        signal.language,
        signal.file,
        signal.name ?? null,
        signal.lineStart ?? null,
        signal.lineEnd ?? null,
        signal.framework ?? null,
        signal.route?.method ?? null,
        signal.route?.path ?? null,
        signal.route?.handler ?? null,
        signal.text,
        JSON.stringify(signal.tags),
        signal.confidence,
        null,
        signal.createdAt,
        signal.updatedAt ?? null,
      ]
    )
  }

  async insertCallEdge(edge: CallEdge): Promise<void> {
    if (!this.db) return

    const id = edge.id || createCallEdgeId(edge.fromFile, edge.fromSymbol, edge.toRaw)

    this.db.run(
      `INSERT OR REPLACE INTO call_edges (id, from_file, from_symbol, from_line, to_raw, to_resolved,
       confidence, edge_type, text, line, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        edge.fromFile,
        edge.fromSymbol,
        edge.fromLine,
        edge.toRaw,
        edge.toResolved ?? null,
        edge.confidence,
        edge.edgeType,
        edge.text,
        edge.line,
        edge.createdAt,
      ]
    )
  }

  async insertImportEdge(edge: ImportEdge): Promise<void> {
    if (!this.db) return

    const id = edge.id || createImportEdgeId(edge.fromFile, edge.toFile)

    this.db.run(
      `INSERT OR REPLACE INTO import_edges (id, from_file, to_file, module_path, imported_symbols_json,
       import_kind, confidence, edge_type, line, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        edge.fromFile,
        edge.toFile,
        edge.modulePath,
        JSON.stringify(edge.importedSymbols),
        edge.importKind,
        edge.confidence,
        edge.edgeType,
        edge.line,
        edge.createdAt,
      ]
    )
  }

  async insertFileRecord(file: FileRecord): Promise<void> {
    if (!this.db) return

    const id = createFileId(file.path, file.contentHash)

    this.db.run(
      `INSERT OR REPLACE INTO files (path, content_hash, language, size_bytes, last_scan_at)
       VALUES (?, ?, ?, ?, ?)`,
      [file.path, file.contentHash, file.language, file.sizeBytes, file.lastScanAt]
    )
  }

  async querySignals(filter: {
    kind?: string
    language?: string
    framework?: string
    file?: string
    name?: string
    query?: string
    limit?: number
  }): Promise<Signal[]> {
    if (!this.db) return []

    let sql = "SELECT * FROM signals WHERE 1=1"
    const params: any[] = []

    if (filter.kind) {
      sql += " AND kind = ?"
      params.push(filter.kind)
    }
    if (filter.language) {
      sql += " AND language = ?"
      params.push(filter.language)
    }
    if (filter.framework) {
      sql += " AND framework = ?"
      params.push(filter.framework)
    }
    if (filter.file) {
      sql += " AND file LIKE ?"
      params.push(`%${filter.file}%`)
    }
    if (filter.name) {
      sql += " AND name LIKE ?"
      params.push(`%${filter.name}%`)
    }
    if (filter.query) {
      sql += " AND (text LIKE ? OR name LIKE ? OR tags_json LIKE ?)"
      const q = `%${filter.query}%`
      params.push(q, q, q)
    }

    sql += " ORDER BY created_at DESC"

    if (filter.limit) {
      sql += ` LIMIT ${filter.limit}`
    }

    const result = this.db.exec(sql, params)
    if (!result.length) return []

    const columns = result[0].columns
    return result[0].values.map((row: any[]) => {
      const obj: Record<string, any> = {}
      columns.forEach((col: string, i: number) => { obj[col] = row[i] })
      return {
        id: obj.id,
        evidenceId: obj.evidence_id,
        kind: obj.kind,
        language: obj.language,
        file: obj.file,
        name: obj.name ?? undefined,
        lineStart: obj.line_start ?? undefined,
        lineEnd: obj.line_end ?? undefined,
        framework: obj.framework ?? undefined,
        route: obj.route_method ? {
          method: obj.route_method,
          path: obj.route_path ?? undefined,
          handler: obj.route_handler ?? undefined,
        } : undefined,
        text: obj.text,
        tags: obj.tags_json ? JSON.parse(obj.tags_json) : [],
        confidence: obj.confidence,
        createdAt: obj.created_at,
        updatedAt: obj.updated_at ?? undefined,
      } as Signal
    })
  }

  async getCallsTo(symbol: string): Promise<CallEdge[]> {
    if (!this.db) return []

    const result = this.db.exec(
      "SELECT * FROM call_edges WHERE to_raw LIKE ? OR to_resolved LIKE ?",
      [`%${symbol}%`, `%${symbol}%`]
    )

    if (!result.length) return []
    return this.rowsToCallEdges(result[0])
  }

  async getCallsFrom(file: string, symbol: string): Promise<CallEdge[]> {
    if (!this.db) return []

    const result = this.db.exec(
      "SELECT * FROM call_edges WHERE from_file = ? AND from_symbol = ?",
      [file, symbol]
    )

    if (!result.length) return []
    return this.rowsToCallEdges(result[0])
  }

  async getImportsTo(file: string): Promise<ImportEdge[]> {
    if (!this.db) return []

    const result = this.db.exec(
      "SELECT * FROM import_edges WHERE to_file LIKE ?",
      [`%${file}%`]
    )

    if (!result.length) return []
    return this.rowsToImportEdges(result[0])
  }

  async getImportsFrom(file: string): Promise<ImportEdge[]> {
    if (!this.db) return []

    const result = this.db.exec(
      "SELECT * FROM import_edges WHERE from_file = ?",
      [file]
    )

    if (!result.length) return []
    return this.rowsToImportEdges(result[0])
  }

  async insertBenchmarkRun(run: BenchmarkRun): Promise<void> {
    if (!this.db) return

    this.db.run(
      `INSERT OR REPLACE INTO benchmark_runs (id, project, repo_url, commit_sha, node_version,
       python_version, os, started_at, completed_at, query_count, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        run.id,
        run.project,
        run.repoUrl ?? null,
        run.commitSha ?? null,
        run.nodeVersion ?? null,
        run.pythonVersion ?? null,
        run.os ?? null,
        run.startedAt,
        run.completedAt ?? null,
        run.queryCount ?? null,
        run.status,
      ]
    )
  }

  async insertBenchmarkQuery(query: BenchmarkQuery): Promise<void> {
    if (!this.db) return

    this.db.run(
      `INSERT OR REPLACE INTO benchmark_queries (id, run_id, query_id, query_text, query_type,
       expected_kind, expected_framework, expected_method, expected_path, file_contains, requires_line)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        query.id,
        query.runId,
        query.queryId,
        query.queryText,
        query.queryType,
        query.expectedKind ?? null,
        query.expectedFramework ?? null,
        query.expectedMethod ?? null,
        query.expectedPath ?? null,
        query.fileContains ?? null,
        query.requiresLine ? 1 : 0,
      ]
    )
  }

  async insertBenchmarkResult(result: BenchmarkResult): Promise<void> {
    if (!this.db) return

    this.db.run(
      `INSERT OR REPLACE INTO benchmark_results (id, run_id, query_id, baseline, top3_hit,
       chars_read, latency_ms, score_json, retrieved_ids_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        result.id,
        result.runId,
        result.queryId,
        result.baseline,
        result.top3Hit ? 1 : 0,
        result.charsRead,
        result.latencyMs,
        result.scoreJson ?? null,
        result.retrievedIdsJson ?? null,
        result.createdAt,
      ]
    )
  }

  async clear(): Promise<void> {
    if (!this.db) return
    this.db.run("DELETE FROM signals")
    this.db.run("DELETE FROM call_edges")
    this.db.run("DELETE FROM import_edges")
    this.db.run("DELETE FROM files")
  }

  async getStats(): Promise<StoreStats> {
    if (!this.db) {
      return {
        signalCount: 0,
        callEdgeCount: 0,
        importEdgeCount: 0,
        fileCount: 0,
        rawSourceChars: 0,
        signalChars: 0,
        storageReductionPercent: 0,
        byKind: {},
        byLanguage: {},
        byFramework: {},
      }
    }

    const signalCount = this.db.exec("SELECT COUNT(*) FROM signals")[0]?.values[0]?.[0] as number ?? 0
    const callEdgeCount = this.db.exec("SELECT COUNT(*) FROM call_edges")[0]?.values[0]?.[0] as number ?? 0
    const importEdgeCount = this.db.exec("SELECT COUNT(*) FROM import_edges")[0]?.values[0]?.[0] as number ?? 0
    const fileCount = this.db.exec("SELECT COUNT(*) FROM files")[0]?.values[0]?.[0] as number ?? 0

    const byKindResult = this.db.exec("SELECT kind, COUNT(*) FROM signals GROUP BY kind")
    const byKind: Record<string, number> = {}
    if (byKindResult.length) {
      byKindResult[0].values.forEach((row: any[]) => { byKind[row[0] as string] = row[1] as number })
    }

    const byLanguageResult = this.db.exec("SELECT language, COUNT(*) FROM signals GROUP BY language")
    const byLanguage: Record<string, number> = {}
    if (byLanguageResult.length) {
      byLanguageResult[0].values.forEach((row: any[]) => { byLanguage[row[0] as string] = row[1] as number })
    }

    const byFrameworkResult = this.db.exec("SELECT framework, COUNT(*) FROM signals WHERE framework IS NOT NULL GROUP BY framework")
    const byFramework: Record<string, number> = {}
    if (byFrameworkResult.length) {
      byFrameworkResult[0].values.forEach((row: any[]) => { if (row[0]) byFramework[row[0] as string] = row[1] as number })
    }

    const textResult = this.db.exec("SELECT SUM(LENGTH(text)) FROM signals")
    const signalChars = textResult[0]?.values[0]?.[0] as number ?? 0

    const rawResult = this.db.exec("SELECT SUM(size_bytes) FROM files")
    const rawSourceChars = rawResult[0]?.values[0]?.[0] as number ?? 0

    const storageReductionPercent = rawSourceChars > 0
      ? Math.round(((rawSourceChars - signalChars) / rawSourceChars) * 100)
      : 0

    return {
      signalCount,
      callEdgeCount,
      importEdgeCount,
      fileCount,
      rawSourceChars,
      signalChars,
      storageReductionPercent,
      byKind,
      byLanguage,
      byFramework,
    }
  }

  private rowsToCallEdges(result: { columns: string[]; values: any[][] }): CallEdge[] {
    return result.values.map(row => {
      const obj: any = {}
      result.columns.forEach((col, i) => { obj[col] = row[i] })
      return {
        id: obj.id,
        fromFile: obj.from_file,
        fromSymbol: obj.from_symbol,
        fromLine: obj.from_line,
        toRaw: obj.to_raw,
        toResolved: obj.to_resolved ?? undefined,
        confidence: obj.confidence,
        edgeType: obj.edge_type as EdgeType,
        text: obj.text,
        line: obj.line,
        createdAt: obj.created_at,
      }
    })
  }

  private rowsToImportEdges(result: { columns: string[]; values: any[][] }): ImportEdge[] {
    return result.values.map(row => {
      const obj: any = {}
      result.columns.forEach((col, i) => { obj[col] = row[i] })
      return {
        id: obj.id,
        fromFile: obj.from_file,
        toFile: obj.to_file,
        modulePath: obj.module_path,
        importedSymbols: obj.imported_symbols_json ? JSON.parse(obj.imported_symbols_json) : [],
        importKind: obj.import_kind as ImportKind,
        confidence: obj.confidence,
        edgeType: obj.edge_type as EdgeType,
        line: obj.line,
        createdAt: obj.created_at,
      }
    })
  }
}