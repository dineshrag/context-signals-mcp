import { extractSignals, parseReadOutput, type Evidence } from "../src/extractor.js"
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
const lines = content.split("\n").slice(0, 20)
console.log("Raw lines (first 10):")
lines.slice(0, 10).forEach((line, i) => console.log(`  ${i}: [${line.substring(0, 40)}]`))

const evidence: Evidence = {
  id: "debug",
  sessionId: "validation",
  tool: "read",
  input: { file: "lib/application.js" },
  output: `<path>lib/application.js</path>
<type>file</type>
<content>
${lines.map((line, i) => `${i + 1}: ${line}`).join("\n")}
</content>`,
  createdAt: Date.now(),
}

console.log("\nEvidence output (first 300 chars):")
console.log(evidence.output.substring(0, 300))

const { file: parsedFile, contentLines } = parseReadOutput(evidence.output)
console.log("\nParsed:")
console.log("  file:", parsedFile)
console.log("  lines:", contentLines.length)
contentLines.slice(0, 10).forEach(l => console.log(`  ${l.lineNo}: [${l.text.substring(0, 40)}]`))

const signals = extractSignals(evidence)
console.log("\nSignals:", signals.length)
signals.forEach(s => console.log(`  - ${s.kind}: ${s.name ?? s.text?.substring(0, 30)}`))