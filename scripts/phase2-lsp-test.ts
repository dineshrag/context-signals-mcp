import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile } from "fs/promises"
import path from "path"
import fg from "fast-glob"

const testRepo = process.argv[2] ?? "axios"
const testDir = testRepo === "express" 
  ? "C:/dev/node_modules/express"
  : testRepo === "lodash"
  ? "C:/dev/node_modules/lodash"
  : `C:/dev/node_modules/${testRepo}`

console.log(`\n## Phase 2: ${testRepo.toUpperCase()} - LSP Mode (Improved)\n==================================================`)

// Better mock LSP document symbol response - more accurate parsing
function mockLspSymbols(content: string, file: string): string {
  const symbols: Array<{name: string, kind: number, range: {start: {line: number}, end: {line: number}}, selectionRange: {start: {line: number}}}> = []
  const lines = content.split("\n")
  
  lines.forEach((line, i) => {
    const trimmed = line.trim()
    const lineNum = i + 1
    
    // Function declarations (actual function def, not variable assignment)
    if (/^(?:export\s+)?(?:async\s+)?function\s+\w+/.test(trimmed)) {
      const match = trimmed.match(/function\s+(\w+)/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 12, // Function
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
    
    // Arrow functions: const foo = () =>
    if (/^const\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/.test(trimmed)) {
      const match = trimmed.match(/const\s+(\w+)\s*=/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 12, // Function
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
    
    // Python def
    if (/^def\s+\w+/.test(trimmed)) {
      const match = trimmed.match(/def\s+(\w+)/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 12, // Function
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
    
    // Go func
    if (/^func\s+\w+/.test(trimmed)) {
      const match = trimmed.match(/func\s+(\w+)/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 12, // Function
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
    
    // Classes
    if (/^(?:export\s+)?class\s+\w+/.test(trimmed)) {
      const match = trimmed.match(/class\s+(\w+)/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 5, // Class
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
    
    // Imports
    if (/^import\s+\w+/.test(trimmed)) {
      const match = trimmed.match(/import\s+(?:{[^}]+}|\w+)(?:\s+as\s+\w+)?\s+from\s+["']([^"']+)["']/)
      if (match) {
        symbols.push({
          name: match[1],
          kind: 6, // Method kind for imports
          range: { start: { line: lineNum }, end: { line: lineNum } },
          selectionRange: { start: { line: lineNum } }
        })
      }
    }
  })
  
  return JSON.stringify(symbols, null, 2)
}

async function runTest() {
  const files = await fg(["lib/**/*.js", "**/index.js"], {
    cwd: testDir,
    absolute: true,
    ignore: ["node_modules/**", "test/**"],
    filesLimit: 20
  })

  let totalRawSize = 0
  let totalSignalSize = 0
  let totalSignals = 0
  let functionsFound = 0
  let importsFound = 0
  let classesFound = 0

  for (const file of files.slice(0, 10)) {
    try {
      const content = await readFile(file, "utf-8")
      const relativePath = path.relative(testDir, file)
      totalRawSize += content.length

      // Use LSP mock
      const lspOutput = mockLspSymbols(content, relativePath)
      
      const evidence: Evidence = {
        id: `test-${relativePath}`,
        sessionId: "phase2-lsp",
        tool: "lsp",
        input: { file: relativePath },
        output: lspOutput,
        createdAt: Date.now(),
      }

      const signals = extractSignals(evidence)
      totalSignals += signals.length
      functionsFound += signals.filter(s => s.kind === "function").length
      classesFound += signals.filter(s => s.kind === "class").length
      importsFound += signals.filter(s => s.kind === "import" || s.kind === "property").length

      const signalJson = JSON.stringify(signals)
      totalSignalSize += signalJson.length
      
      console.log(`File: ${relativePath} - ${signals.length} signals`)
    } catch (e) {
      console.error("Error:", e)
    }
  }

  const reduction = ((totalRawSize - totalSignalSize) / totalRawSize * 100).toFixed(1)
  
  console.log(`\n## TOTALS`)
  console.log(`==================================================`)
  console.log(`Files processed: 10`)
  console.log(`Raw Size: ${totalRawSize} chars`)
  console.log(`Signal Size: ${totalSignalSize} chars`)
  console.log(`Total Signals: ${totalSignals}`)
  console.log(`Functions: ${functionsFound}, Imports: ${importsFound}, Classes: ${classesFound}`)
  console.log(`Compression: ${reduction}%`)
  
  return {
    raw: totalRawSize,
    signal: totalSignalSize,
    signals: totalSignals,
    reduction: parseFloat(reduction)
  }
}

runTest().catch(console.error)