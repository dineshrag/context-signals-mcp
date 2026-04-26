import { extractSignals, type Evidence } from "../src/extractor.js"
import { readFile } from "fs/promises"

const repoPath = "C:/dev/node_modules/express"
const fg = (await import("fast-glob")).default
const files = await fg(["lib/*.js"], {
  cwd: repoPath,
  absolute: true,
})

const file = files[0]
console.log("File:", file)
const content = await readFile(file, "utf-8")

const fileName = file.split(/[\\/]/).pop() ?? "unknown"
console.log("File name:", fileName)
console.log("Content first 10 lines:")
content.split("\n").slice(0, 10).forEach((line, i) => console.log(`  ${i + 1}: ${line}`))

const evidence: Evidence = {
  id: "debug",
  sessionId: "validation",
  tool: "read",
  input: { file: fileName },
  output: `<path>${fileName}</path>
<type>file</type>
<content>
${content.split("\n").slice(0, 20).map((line, i) => `${i + 1}: ${line}`).join("\n")}
</content>`,
  createdAt: Date.now(),
}

const signals = extractSignals(evidence)
console.log("\nSignals found:", signals.length)
signals.forEach((s) => console.log(`  - ${s.kind}: ${s.name ?? s.text}`))