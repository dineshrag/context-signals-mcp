import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile, writeFile } from "fs/promises"
import fg from "fast-glob"

async function measureCompactSignals(content: string, fileName: string): Promise<number> {
  const lines = content.split("\n").slice(0, 100)
  const evidence: Evidence = {
    id: "test",
    sessionId: "phase2",
    tool: "read",
    input: { file: fileName },
    output: `<path>${fileName}</path>
<type>file</type>
<content>
${lines.map((line, i) => `${i + 1}: ${line}`).join("\n")}
</content>`,
    createdAt: Date.now(),
  }

  const signals = extractSignals(evidence)

  const compactSignals = signals
    .filter(s => s.kind !== "file_read")
    .map(s => `${s.kind}:${s.name || s.text?.substring(0, 20)}`)
    .join("\n")

  return compactSignals.length
}

async function measureFullStorage(content: string, fileName: string): Promise<number> {
  const lines = content.split("\n").slice(0, 100)
  const evidence: Evidence = {
    id: "test",
    sessionId: "phase2",
    tool: "read",
    input: { file: fileName },
    output: `<path>${fileName}</path>
<type>file</type>
<content>
${lines.map((line, i) => `${i + 1}: ${line}`).join("\n")}
</content>`,
    createdAt: Date.now(),
  }

  const signals = extractSignals(evidence)
  return JSON.stringify(signals).length
}

async function main() {
  console.log("## Express Phase 2 - Detailed Measurement")
  console.log("=".repeat(50))

  const repoPath = process.argv[2] === "lodash" 
    ? "C:/dev/node_modules/lodash" 
    : "C:/dev/node_modules/express"
  const repoName = process.argv[2] === "lodash" ? "lodash" : "express"
  
  const files = await fg(["lib/**/*.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**"]
  })

  let totalRaw = 0
  let totalFullStorage = 0
  let totalCompact = 0

  for (const file of files.slice(0, 20)) {
    const content = await readFile(file, "utf-8")
    const relativePath = file.split(/[\\/]/).slice(-2).join("/")
    
    const raw = content.split("\n").slice(0, 100).join("\n").length
    const fullStorage = await measureFullStorage(content, relativePath)
    const compact = await measureCompactSignals(content, relativePath)

    totalRaw += raw
    totalFullStorage += fullStorage
    totalCompact += compact
  }

  const fullReductionPct = totalRaw > 0 ? ((totalRaw - totalFullStorage) / totalRaw * 100).toFixed(1) : "0"
  const compactReductionPct = totalRaw > 0 ? ((totalRaw - totalCompact) / totalRaw * 100).toFixed(1) : "0"

  console.log(`\n## ${repoName} - 20 files, 100 lines each:`)
  console.log("Raw content:", totalRaw)
  console.log("Full Signal JSON:", totalFullStorage)
  console.log("Compact text:", totalCompact)
  console.log("\nFull Storage reduction:", fullReductionPct + "%")
  console.log("Compact reduction:", compactReductionPct + "%")

  const results = {
    repo: repoName,
    files: 20,
    rawChars: totalRaw,
    fullSignalJson: totalFullStorage,
    compactText: totalCompact,
    fullReduction: fullReductionPct + "%",
    compactReduction: compactReductionPct + "%"
  }

  await writeFile(`C:/dev/node_modules/${repoName}-phase2-analysis.json`, JSON.stringify(results, null, 2))
  console.log("\nSaved to " + repoName + "-phase2-analysis.json")
}

main().catch(console.error)