import { readdir, readFile, writeFile } from "fs/promises"
import path from "path"

interface Signal {
  kind: string
  name: string
  file: string
  line?: number
  lineEnd?: number
  text?: string
}

async function extractSignalsFromFile(filePath: string): Promise<Signal[]> {
  const signals: Signal[] = []
  const content = await readFile(filePath, "utf-8")
  const lines = content.split("\n")

  const routePatterns = [
    /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi,
    /app\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi,
    /server\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi,
    /FastifyInstance.*\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi,
  ]

  const functionPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g
  const constFunctionPattern = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g
  const classPattern = /(?:export\s+)?class\s+(\w+)/g
  const interfacePattern = /(?:export\s+)?interface\s+(\w+)/g
  const typePattern = /(?:export\s+)?type\s+(\w+)/g
  const importPattern = /import\s+(?:\{[^}]+\}|[\w]+)\s+from\s+['"]([^'"]+)['"]/g
  const requirePattern = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    let match

    for (const pattern of routePatterns) {
      pattern.lastIndex = 0
      while ((match = pattern.exec(line)) !== null) {
        signals.push({
          kind: "route",
          name: `${match[1].toUpperCase()} ${match[2]}`,
          file: filePath,
          line: lineNum,
          text: line.trim().substring(0, 100)
        })
      }
    }

    functionPattern.lastIndex = 0
    while ((match = functionPattern.exec(line)) !== null) {
      if (!match[1].startsWith("_") && match[1] !== "constructor") {
        signals.push({
          kind: "function",
          name: match[1],
          file: filePath,
          line: lineNum,
          text: line.trim().substring(0, 100)
        })
      }
    }

    constFunctionPattern.lastIndex = 0
    while ((match = constFunctionPattern.exec(line)) !== null) {
      if (!match[1].startsWith("_")) {
        signals.push({
          kind: "function",
          name: match[1],
          file: filePath,
          line: lineNum,
          text: line.trim().substring(0, 100)
        })
      }
    }

    classPattern.lastIndex = 0
    while ((match = classPattern.exec(line)) !== null) {
      signals.push({
        kind: "class",
        name: match[1],
        file: filePath,
        line: lineNum,
        text: line.trim().substring(0, 100)
      })
    }

    interfacePattern.lastIndex = 0
    while ((match = interfacePattern.exec(line)) !== null) {
      signals.push({
        kind: "interface",
        name: match[1],
        file: filePath,
        line: lineNum,
        text: line.trim().substring(0, 100)
      })
    }

    typePattern.lastIndex = 0
    while ((match = typePattern.exec(line)) !== null) {
      signals.push({
        kind: "type",
        name: match[1],
        file: filePath,
        line: lineNum,
        text: line.trim().substring(0, 100)
      })
    }

    importPattern.lastIndex = 0
    while ((match = importPattern.exec(line)) !== null) {
      signals.push({
        kind: "import",
        name: match[1],
        file: filePath,
        line: lineNum,
        text: line.trim().substring(0, 100)
      })
    }

    requirePattern.lastIndex = 0
    while ((match = requirePattern.exec(line)) !== null) {
      signals.push({
        kind: "import",
        name: match[1],
        file: filePath,
        line: lineNum,
        text: line.trim().substring(0, 100)
      })
    }
  }

  return signals
}

async function collectSourceFiles(dirPath: string): Promise<string[]> {
  const files: string[] = []

  try {
    const entries = await readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        if (!["node_modules", ".git", "dist", "build", ".next"].includes(entry.name)) {
          files.push(...await collectSourceFiles(fullPath))
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name)
        if ([".ts", ".tsx", ".js", ".jsx"].includes(ext)) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Ignore errors
  }

  return files
}

async function main() {
  const fixtures = ["express-app", "fastify-app", "nextjs-app"]

  for (const fixture of fixtures) {
    const fixturePath = path.join("benchmarks", "fixtures", fixture)
    console.log(`\nExtracting signals from ${fixture}...`)

    const files = await collectSourceFiles(fixturePath)
    console.log(`  Found ${files.length} source files`)

    const allSignals: Signal[] = []

    for (const file of files) {
      const signals = await extractSignalsFromFile(file)
      allSignals.push(...signals)
    }

    const relativeSignals = allSignals.map(sig => ({
      ...sig,
      file: sig.file.replace(fixturePath, "").replace(/\\/g, "/").replace(/^\//, "")
    }))

    const outputPath = path.join(fixturePath, "signals.json")
    await writeFile(outputPath, JSON.stringify(relativeSignals, null, 2), "utf-8")
    console.log(`  Extracted ${relativeSignals.length} signals to ${outputPath}`)

    const byKind: Record<string, number> = {}
    for (const sig of relativeSignals) {
      byKind[sig.kind] = (byKind[sig.kind] || 0) + 1
    }
    console.log(`  By kind:`, byKind)
  }

  console.log("\nDone!")
}

main().catch(console.error)
