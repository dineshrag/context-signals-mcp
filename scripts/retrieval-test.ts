import { searchSignals, type SearchOptions } from "../src/search.js"
import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile } from "fs/promises"
import fg from "fast-glob"

const repoName = process.argv[2] === "lodash" ? "lodash" : "express"
const repoPath = repoName === "lodash" 
  ? "C:/dev/node_modules/lodash" 
  : "C:/dev/node_modules/express"

async function buildSignalStore(repoPath: string) {
  const files = await fg(["lib/**/*.js", "**/index.js"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**", "dist/**", "test/**"]
  })

  let allSignals: any[] = []

  for (const file of files.slice(0, 30)) {
    const content = await readFile(file, "utf-8")
    const relativePath = file.split(/[\\/]/).slice(-2).join("/")
    
    const evidence: Evidence = {
      id: relativePath,
      sessionId: "test",
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
    allSignals.push(...signals)
  }

  return allSignals
}

const testQueries = {
  express: [
    { query: "router", expected: true },
    { query: "finalhandler", expected: true },
    { query: "listen", expected: true },
    { query: "debug", expected: true }
  ],
  lodash: [
    { query: "each", expected: true },
    { query: "map", expected: true },
    { query: "filter", expected: true },
    { query: "reduce", expected: true }
  ]
}

async function main() {
  console.log(`\n## ${repoName.toUpperCase()} - Retrieval Accuracy Test`)
  console.log("=".repeat(50))

  const signals = await buildSignalStore(repoPath)
  console.log("Total signals in store:", signals.length)

  const queries = testQueries[repoName as keyof typeof testQueries]
  
  let totalHits = 0

  for (const q of queries) {
    const options: SearchOptions = {
      query: q.query,
      limit: 10,
      kind: undefined
    }
    const results = searchSignals(signals, options)
    const hitCount = results.length
    
    totalHits += hitCount

    const queryLabel = q.query
    console.log("")
    console.log("Query:", queryLabel)
    console.log("  Found:", hitCount, "results")
    results.slice(0, 3).forEach(r => {
      const nameOrText = r.name || r.text?.substring(0, 25) || ""
      console.log("   -", r.kind, nameOrText)
    })
  }

  const avgHitsPerQuery = totalHits / queries.length
  const successRate = (avgHitsPerQuery / 3) * 100
  
  console.log("")
  console.log("## Retrieval Summary")
  console.log("Queries tested:", queries.length)
  console.log("Total hits:", totalHits)
  const srStr = successRate.toFixed(1)
  console.log("Success rate:", srStr + "%")

  const fs = await import("fs/promises")
  await fs.writeFile(
    `C:/dev/node_modules/${repoName}-retrieval-test.json`,
    JSON.stringify({
      repo: repoName,
      totalSignals: signals.length,
      queries: queries.length,
      totalHits: totalHits,
      successRate: successRate.toFixed(1) + "%"
    }, null, 2)
  )
  console.log("\nSaved to " + repoName + "-retrieval-test.json")
}

main().catch(console.error)