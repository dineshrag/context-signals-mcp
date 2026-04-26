import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile } from "fs/promises"
import path from "path"
import fg from "fast-glob"

async function extractFromRepo(repoPath: string, repoName: string) {
  console.log(`\n## Testing ${repoName}`)
  console.log("=".repeat(40))
  const files = await fg(["**/*.js", "**/*.ts", "**/*.mjs"], {
    cwd: repoPath,
    absolute: true,
    ignore: ["node_modules/**", "test/**", "docs/**"],
  })

  let totalFiles = 0
  let totalFunctions = 0
  let totalClasses = 0
  let totalRoutes = 0
  let totalImports = 0
  let errors = 0

  for (const file of files.slice(0, 100)) {
    try {
      const content = await readFile(file, "utf-8")
      const relativePath = path.relative(repoPath, file)

      const evidence: Evidence = {
        id: `test-${relativePath}`,
        sessionId: "validation",
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
      if (totalFiles < 3) {
        console.log("Signals:", signals.map(s => ({ kind: s.kind, name: s.name, text: s.text?.substring(0, 30) })))
      }
      const codeSignals = signals.filter((s) => s.kind !== "file_read")
      if (codeSignals.length > 0 || totalFiles < 3) {
        console.log(`${relativePath}: ${codeSignals.length} code signals`)
        codeSignals.forEach((s) => console.log(`  ${s.kind}: ${s.name ?? s.text?.substring(0, 30)}`))
      }
      totalFiles++
      totalFunctions += codeSignals.filter((s) => s.kind === "function").length
      totalClasses += codeSignals.filter((s) => s.kind === "class").length
      totalRoutes += codeSignals.filter((s) => s.kind === "route").length
      totalImports += codeSignals.filter((s) => s.kind === "import").length
    } catch {
      errors++
    }
  }

  console.log(`Files processed: ${totalFiles}`)
  console.log(`Errors: ${errors}`)
  console.log(`Functions: ${totalFunctions}`)
  console.log(`Classes: ${totalClasses}`)
  console.log(`Routes: ${totalRoutes}`)
  console.log(`Imports: ${totalImports}`)
  console.log(`Total signals: ${totalFunctions + totalClasses + totalRoutes + totalImports}`)

  return { files: totalFiles, functions: totalFunctions, classes: totalClasses, routes: totalRoutes, imports: totalImports, errors }
}

async function main() {
  const expressResults = await extractFromRepo("C:/dev/node_modules/express", "Express.js")
  const lodashResults = await extractFromRepo("C:/dev/node_modules/lodash", "Lodash")

  console.log("\n## Summary")
  console.log("=".repeat(40))
  console.table({ Express: expressResults, Lodash: lodashResults })
}

main().catch(console.error)