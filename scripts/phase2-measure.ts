import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile, writeFile, mkdir } from "fs/promises"
import path from "path"
import fg from "fast-glob"

const testRepo = process.argv[2] ?? "express"
const testDir = testRepo === "express" 
  ? "C:/dev/node_modules/express"
  : "C:/dev/node_modules/lodash"

const prompts = {
  express: [
    "Find the middleware registration logic",
    "Find route handlers for GET/POST",
    "Find error handling middleware",
    "Find where app.listen() is called"
  ],
  lodash: [
    "Find array manipulation functions",
    "Find collection iteration functions",
    "Find function utilities",
    "Find object utilities"
  ]
}

async function runPrompt(prompt: string, repoPath: string) {
  const files = await fg(["lib/**/*.js", "**/index.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**", "test/**"],
    filesLimit: 20
  })

  let totalRawSize = 0
  let totalSignalSize = 0
  let totalSignals = 0
  let totalFiles = 0
  let functionsFound = 0
  let importsFound = 0
  let routesFound = 0
  const allSignals: any[] = []

  for (const file of files.slice(0, 10)) {
    try {
      const content = await readFile(file, "utf-8")
      const relativePath = path.relative(repoPath, file)
      totalRawSize += content.length
      totalFiles++

      const evidence: Evidence = {
        id: `test-${relativePath}`,
        sessionId: "phase2",
        tool: "read",
        input: { file: relativePath },
        output: `<path>${relativePath}</path>
<type>file</type>
<content>
${content.split("\n").slice(0, 100).map((line, i) => `${i + 1}: ${line}`).join("\n")}
</content>`,
        createdAt: Date.now(),
      }

      const signals = extractSignals(evidence)
      totalSignals += signals.length
      allSignals.push(...signals)

      functionsFound += signals.filter(s => s.kind === "function").length
      importsFound += signals.filter(s => s.kind === "import").length
      routesFound += signals.filter(s => s.kind === "route").length

      const signalJson = JSON.stringify(signals)
      totalSignalSize += signalJson.length
    } catch (e) {
      console.error("Error:", e)
    }
  }

  return {
    prompt,
    filesRead: totalFiles,
    rawSize: totalRawSize,
    signalSize: totalSignalSize,
    signals: totalSignals,
    functions: functionsFound,
    imports: importsFound,
    routes: routesFound,
    compressionRatio: totalRawSize > 0 ? ((totalRawSize - totalSignalSize) / totalRawSize * 100).toFixed(1) + "%" : "0%",
    allSignals
  }
}

async function main() {
  console.log(`\n## Phase 2: ${testRepo} Measurement`)
  console.log("=".repeat(50))
  console.log("Prompt,Files,Raw Size,Signal Size,Signals,Funcs,Imports,Routes,Reduction")

  const testPrompts = prompts[testRepo as keyof typeof prompts] ?? prompts.express
  const results: any[] = []

  for (const prompt of testPrompts) {
    const result = await runPrompt(prompt, testDir)
    
    console.log(`${prompt.substring(0,30)},${result.filesRead},${result.rawSize},${result.signalSize},${result.signals},${result.functions},${result.imports},${result.routes},${result.compressionRatio}`)
    
    results.push(result)
  }

  const totals = results.reduce((acc, r) => ({
    files: acc.files + r.filesRead,
    raw: acc.raw + r.rawSize,
    signal: acc.signal + r.signalSize,
    signals: acc.signals + r.signals,
    functions: acc.functions + r.functions,
    imports: acc.imports + r.imports,
    routes: acc.routes + r.routes
  }), { files: 0, raw: 0, signal: 0, signals: 0, functions: 0, imports: 0, routes: 0 })

  console.log(`\n## TOTALS`)
  console.log("=".repeat(50))
  console.log(`Files: ${totals.files}`)
  console.log(`Raw Size: ${totals.raw} chars`)
  console.log(`Signal Size: ${totals.signal} chars`)
  console.log(`Total Signals: ${totals.signals}`)
  console.log(`Functions: ${totals.functions}`)
  console.log(`Imports: ${totals.imports}`)
  console.log(`Routes: ${totals.routes}`)
  
  const totalReduction = totals.raw > 0 ? ((totals.raw - totals.signal) / totals.raw * 100).toFixed(1) + "%" : "0%"
  console.log(`\nCompression: ${totalReduction}`)

  await writeFile(
    `C:/dev/node_modules/${testRepo}-phase2-results.json`,
    JSON.stringify({ 
      repo: testRepo,
      prompts: testPrompts,
      results,
      totals,
      compression: totalReduction
    }, null, 2)
  )

  console.log(`\nResults saved to C:/dev/node_modules/${testRepo}-phase2-results.json`)
}

main().catch(console.error)