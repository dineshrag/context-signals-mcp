import { readFile, writeFile, mkdir, readdir, stat } from "fs/promises"
import path from "path"
import type { BenchmarkQuery } from "../types/benchmark.js"

export interface GroundTruthQuery {
  id: string
  query: string
  category: "navigation" | "route_discovery" | "handler_lookup" | "dependency_lookup" | "implementation_lookup"
  expected: {
    kind: "route" | "function" | "class" | "interface" | "middleware" | "import" | "component"
    method?: string
    path?: string
    file?: string
    handler?: string
    lineRequired: boolean
  }
  difficulty: "easy" | "medium" | "hard"
}

export interface GroundTruth {
  fixture: string
  version: string
  totalFiles?: number
  totalSourceChars?: number
  queries: GroundTruthQuery[]
}

export async function loadGroundTruth(fixtureName: string): Promise<GroundTruth> {
  const filePath = path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
  const content = await readFile(filePath, "utf-8")
  return JSON.parse(content) as GroundTruth
}

export async function saveGroundTruth(fixtureName: string, groundTruth: GroundTruth): Promise<void> {
  const filePath = path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
  await writeFile(filePath, JSON.stringify(groundTruth, null, 2), "utf-8")
}

export function validateGroundTruth(groundTruth: GroundTruth): string[] {
  const errors: string[] = []

  if (!groundTruth.fixture) errors.push("Missing 'fixture' field")
  if (!groundTruth.version) errors.push("Missing 'version' field")
  if (!Array.isArray(groundTruth.queries)) {
    errors.push("Missing or invalid 'queries' array")
  } else {
    for (const query of groundTruth.queries) {
      if (!query.id) errors.push(`Query missing 'id'`)
      if (!query.query) errors.push(`Query ${query.id} missing 'query'`)
      if (!query.category) errors.push(`Query ${query.id} missing 'category'`)
      if (!query.expected) errors.push(`Query ${query.id} missing 'expected'`)
      if (!query.expected?.kind) errors.push(`Query ${query.id} expected missing 'kind'`)
      if (query.expected?.lineRequired === undefined) errors.push(`Query ${query.id} expected missing 'lineRequired'`)
    }
  }

  return errors
}

export function getGroundTruthFilePath(fixtureName: string): string {
  return path.join("benchmarks", "ground-truth", `${fixtureName}.json`)
}

export async function listGroundTruths(): Promise<string[]> {
  const dirPath = path.join("benchmarks", "ground-truth")
  const files = await readdir(dirPath)
  return files
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(".json", ""))
}

export async function countSourceChars(dirPath: string): Promise<number> {
  let totalChars = 0
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
        totalChars += await countSourceChars(fullPath)
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go"].includes(ext)) {
        const content = await readFile(fullPath, "utf-8")
        totalChars += content.length
      }
    }
  }

  return totalChars
}

export async function countSourceFiles(dirPath: string): Promise<number> {
  let totalFiles = 0
  const entries = await readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "dist", "build"].includes(entry.name)) {
        totalFiles += await countSourceFiles(fullPath)
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go"].includes(ext)) {
        totalFiles++
      }
    }
  }

  return totalFiles
}