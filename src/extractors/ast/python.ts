import { spawn, ChildProcess } from "child_process"
import type { LanguageAdapter, ExtractResult } from "../adapter.js"
import type { Signal } from "../../types/signal.js"
import type { CallEdge, ImportEdge } from "../../storage/sql-store.js"
import { createSignalId, createCallEdgeId, createImportEdgeId } from "../../utils/signal-id.js"

interface JSONRPCRequest {
  jsonrpc: "2.0"
  id: number | string
  method: string
  params: Record<string, any>
}

interface JSONRPCResponse {
  jsonrpc: "2.0"
  id: number | string
  result?: any
  error?: { code: number; message: string }
}

let requestId = 0

function nextId(): number {
  return ++requestId
}

export class PythonAdapter implements LanguageAdapter {
  language = "python"
  private worker: ChildProcess | null = null
  private workerPath: string
  private pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: any) => void }> = new Map()
  private initialized = false
  private restartCount = 0
  private maxRestarts = 3

  constructor(workerPath: string = "python") {
    this.workerPath = workerPath
  }

  async init(): Promise<void> {
    if (this.initialized) return

    await this.startWorker()
    await this.ping()
    this.initialized = true
  }

  private async startWorker(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.worker = spawn(this.workerPath, ["scripts/python-worker.py"], {
          stdio: ["pipe", "pipe", "pipe"],
          env: { ...process.env, PYTHONIOENCODING: "utf-8" }
        })

        let buffer = ""

        this.worker!.stdout?.on("data", (data: Buffer) => {
          buffer += data.toString()
          const lines = buffer.split("\n")

          for (let i = 0; i < lines.length - 1; i++) {
            this.handleResponse(lines[i])
          }
          buffer = lines[lines.length - 1]
        })

        this.worker!.stderr?.on("data", (data: Buffer) => {
          console.error("Python worker stderr:", data.toString())
        })

        this.worker!.on("error", (err) => {
          console.error("Python worker error:", err)
          this.handleWorkerDeath()
        })

        this.worker!.on("exit", (code) => {
          if (code !== 0) {
            console.error(`Python worker exited with code ${code}`)
            this.handleWorkerDeath()
          }
        })

        setTimeout(() => resolve(), 100)
      } catch (err) {
        reject(err)
      }
    })
  }

  private handleWorkerDeath(): void {
    this.worker = null
    this.initialized = false

    if (this.restartCount < this.maxRestarts) {
      this.restartCount++
      const delay = Math.pow(2, this.restartCount) * 1000
      console.log(`Restarting Python worker in ${delay}ms (attempt ${this.restartCount})`)
      setTimeout(() => this.init(), delay)
    }
  }

  private handleResponse(line: string): void {
    if (!line.trim()) return

    try {
      const response: JSONRPCResponse = JSON.parse(line)
      const pending = this.pendingRequests.get(response.id as number)

      if (pending) {
        this.pendingRequests.delete(response.id as number)
        if (response.error) {
          pending.reject(new Error(response.error.message))
        } else {
          pending.resolve(response.result)
        }
      }
    } catch (e) {
      console.error("Failed to parse response:", line)
    }
  }

  private async sendRequest(method: string, params: Record<string, any>): Promise<any> {
    if (!this.worker || !this.worker.stdin) {
      throw new Error("Worker not running")
    }

    const id = nextId()
    const request: JSONRPCRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      const message = JSON.stringify(request) + "\n"
      this.worker!.stdin!.write(message, (err) => {
        if (err) {
          this.pendingRequests.delete(id)
          reject(err)
        }
      })

      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`Request ${id} timed out`))
        }
      }, 30000)
    })
  }

  private async ping(): Promise<void> {
    try {
      await this.sendRequest("ping", {})
    } catch (e) {
      throw new Error("Failed to ping Python worker")
    }
  }

  canExtract(file: string): boolean {
    return file.endsWith(".py")
  }

  async extract(content: string, file: string): Promise<ExtractResult> {
    if (!this.initialized) {
      await this.init()
    }

    try {
      const raw = await this.sendRequest("extract", { file, content })

      const signals: Signal[] = (raw.signals || []).map((s: any) => ({
        id: createSignalId(file, s.name || s.text, s.lineStart || 0),
        evidenceId: `python-${file}-${s.lineStart}`,
        kind: s.kind || "function",
        language: "python" as const,
        file: s.file || file,
        name: s.name,
        lineStart: s.lineStart,
        lineEnd: s.lineEnd,
        framework: s.framework,
        route: s.route ? { method: s.route.method, path: s.route.path, handler: s.route.handler } : undefined,
        text: s.text || "",
        tags: s.tags || [],
        confidence: s.confidence ?? 0.8,
        createdAt: s.createdAt || Date.now(),
      }))

      const calls: CallEdge[] = (raw.calls || []).map((c: any) => ({
        id: createCallEdgeId(c.fromFile || file, c.fromSymbol, c.toRaw),
        fromFile: c.fromFile || file,
        fromSymbol: c.fromSymbol,
        fromLine: c.fromLine || c.line,
        toRaw: c.toRaw,
        toResolved: c.toResolved,
        confidence: c.confidence ?? 0.5,
        edgeType: c.edgeType || "static",
        text: c.text || "",
        line: c.line,
        createdAt: c.createdAt || Date.now(),
      }))

      const imports: ImportEdge[] = (raw.imports || []).map((i: any) => ({
        id: createImportEdgeId(i.fromFile || file, i.toFile),
        fromFile: i.fromFile || file,
        toFile: i.toFile,
        modulePath: i.modulePath,
        importedSymbols: i.importedSymbols || [],
        importKind: i.importKind || "import",
        confidence: i.confidence ?? 1.0,
        edgeType: i.edgeType || "static",
        line: i.line,
        createdAt: i.createdAt || Date.now(),
      }))

      return {
        signals,
        calls,
        imports,
        errors: raw.errors || [],
        language: "python"
      }
    } catch (e) {
      return {
        signals: [],
        calls: [],
        imports: [],
        errors: [String(e)],
        language: "python"
      }
    }
  }

  destroy(): void {
    if (this.worker) {
      this.worker.kill()
      this.worker = null
    }
    this.initialized = false
    this.restartCount = 0
  }
}