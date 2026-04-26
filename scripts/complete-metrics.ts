import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile, writeFile } from "fs/promises"
import fg from "fast-glob"

const repoName = process.argv[2] === "lodash" ? "lodash" : "express"
const repoPath = repoName === "lodash" 
  ? "C:/dev/node_modules/lodash" 
  : "C:/dev/node_modules/express"

async function measureFullBaseline(repoPath: string) {
  const files = await fg(["lib/**/*.js", "**/index.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**", "test/**"]
  })

  let totalFullSize = 0
  let totalTruncated100 = 0
  let totalTruncated50 = 0

  for (const file of files.slice(0, 20)) {
    const content = await readFile(file, "utf-8")
    totalFullSize += content.length
    totalTruncated100 += content.split("\n").slice(0, 100).join("\n").length
    totalTruncated50 += content.split("\n").slice(0, 50).join("\n").length
  }

  return { fullSize: totalFullSize, truncated100: totalTruncated100, truncated50: totalTruncated50 }
}

async function measureExtractionTime(repoPath: string) {
  const files = await fg(["lib/**/*.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**"]
  })

  const startTime = Date.now()
  
  for (const file of files.slice(0, 20)) {
    const content = await readFile(file, "utf-8")
    const relativePath = file.split(/[\\/]/).slice(-2).join("/")
    
    const evidence: Evidence = {
      id: "test",
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
    extractSignals(evidence)
  }

  const endTime = Date.now()
  return { totalMs: endTime - startTime, perFile: (endTime - startTime) / 20 }
}

async function measureSignalQuality(repoPath: string) {
  const files = await fg(["lib/**/*.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**"]
  })

  let totalSignals = 0
  let functions = 0
  let imports = 0
  let routes = 0
  let classes = 0

  for (const file of files.slice(0, 10)) {
    const content = await readFile(file, "utf-8")
    const relativePath = file.split(/[\\/]/).slice(-2).join("/")
    
    const evidence: Evidence = {
      id: "test",
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
    functions += signals.filter(s => s.kind === "function").length
    imports += signals.filter(s => s.kind === "import").length
    routes += signals.filter(s => s.kind === "route").length
    classes += signals.filter(s => s.kind === "class").length
  }

  return { totalSignals, functions, imports, routes, classes }
}

async function measureCompactAndStorage(repoPath: string) {
  const files = await fg(["lib/**/*.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**"]
  })

  let rawSize = 0
  let fullSignalSize = 0
  let compactSize = 0

  for (const file of files.slice(0, 20)) {
    const content = await readFile(file, "utf-8")
    const relativePath = file.split(/[\\/]/).slice(-2).join("/")
    
    const evidence: Evidence = {
      id: "test",
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
    
    rawSize += content.split("\n").slice(0, 100).join("\n").length
    fullSignalSize += JSON.stringify(signals).length
    
    const compact = signals
      .filter(s => s.kind !== "file_read")
      .map(s => `${s.kind}:${s.name || s.text?.substring(0, 15)}`)
      .join(";")
    compactSize += compact.length
  }

  return { 
    raw: rawSize, 
    fullSignal: fullSignalSize, 
    compact: compactSize,
    fullChange: ((rawSize - fullSignalSize) / rawSize * 100).toFixed(1),
    compactChange: ((rawSize - compactSize) / rawSize * 100).toFixed(1)
  }
}

async function main() {
  console.log(`\n## ${repoName.toUpperCase()} - Complete Phase 2 Metrics`)
  console.log("=".repeat(50))

  // Step 1: Full baseline
  console.log("\n### Step 1: Baseline Comparison")
  const baseline = await measureFullBaseline(repoPath)
  console.log("Full file size (all lines):", baseline.fullSize)
  console.log("Truncated 100 lines:", baseline.truncated100)
  console.log("Truncated 50 lines:", baseline.truncated50)

  // Step 2: Extraction time
  console.log("\n### Step 2: Extraction Time (20 files)")
  const time = await measureExtractionTime(repoPath)
  console.log("Total time:", time.totalMs, "ms")
  console.log("Per file:", time.perFile.toFixed(2), "ms")

  // Step 3: Signal quality
  console.log("\n### Step 3: Signal Distribution")
  const quality = await measureSignalQuality(repoPath)
  console.log("Total signals:", quality.totalSignals)
  console.log("Functions:", quality.functions)
  console.log("Imports:", quality.imports)
  console.log("Routes:", quality.routes)
  console.log("Classes:", quality.classes)

  // Step 4: Storage comparison
  console.log("\n### Step 4: Storage Comparison")
  const storage = await measureCompactAndStorage(repoPath)
  console.log("Raw content (100 lines):", storage.raw)
  console.log("Full signal JSON:", storage.fullSignal)
  console.log("Compact text:", storage.compact)
  console.log("Full storage change:", storage.fullChange + "%")
  console.log("Compact reduction:", storage.compactChange + "%")

  // Save results
  const results = {
    repo: repoName,
    step1_baseline: baseline,
    step2_extractionTime: time,
    step3_signalDistribution: quality,
    step4_storageComparison: storage,
    timestamp: new Date().toISOString()
  }

  await writeFile(
    `C:/dev/node_modules/${repoName}-complete-metrics.json`,
    JSON.stringify(results, null, 2)
  )
  console.log("\nSaved to " + repoName + "-complete-metrics.json")
}

main().catch(console.error)