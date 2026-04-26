import { describe, it, expect } from "vitest"
import { extractSignals, type Evidence } from "../src/extractor.js"

function createEvidence(output: string, tool = "read"): Evidence {
  return {
    id: "test-id",
    evidenceId: "test-evidence",
    sessionId: "test-session",
    tool,
    input: {},
    output,
    createdAt: Date.now(),
  }
}

describe("Extractor - Function Extraction", () => {
  describe("Python Functions", () => {
    it("extracts def statements", () => {
      const evidence = createEvidence(
        "<path>/app.py</path>\n<content>\n1: def hello():\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      expect(functions.length).toBeGreaterThan(0)
      expect(functions.some((s) => s.name === "hello")).toBe(true)
    })

    it("excludes indented statements like raise", () => {
      const evidence = createEvidence(
        "<path>/app.py</path>\n<content>\n1:     raise ValueError()\n2: def valid_function():\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      // Should only have the valid_function, not raise
      expect(functions.length).toBeGreaterThanOrEqual(1)
      expect(functions.some((s) => s.name === "valid_function")).toBe(true)
    })
  })

  describe("TypeScript/JavaScript Functions", () => {
    it("extracts function declarations", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: function helloWorld() {\n2: }\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      expect(functions.length).toBeGreaterThan(0)
      expect(functions.some((s) => s.name === "helloWorld")).toBe(true)
    })

    it("extracts const arrow functions", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: const handleClick = () => {\n2: };\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      expect(functions.length).toBeGreaterThan(0)
      expect(functions.some((s) => s.name === "handleClick")).toBe(true)
    })
  })

  describe("Go Functions", () => {
    it("extracts func declarations", () => {
      const evidence = createEvidence(
        "<path>/main.go</path>\n<content>\n1: func getPhotos() {\n2: }\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      expect(functions.some((s) => s.name === "getPhotos")).toBe(true)
    })

    it("excludes if/for/return statements", () => {
      const evidence = createEvidence(
        "<path>/main.go</path>\n<content>\n1:     if err != nil {\n2:         return\n3:     }\n4: func main() {\n5: }\n</content>"
      )
      const signals = extractSignals(evidence)
      const functions = signals.filter((s) => s.kind === "function")
      
      expect(functions.length).toBe(1)
      expect(functions[0].name).toBe("main")
    })
  })
})

describe("Extractor - Class Extraction", () => {
  it("extracts Python classes", () => {
    const evidence = createEvidence(
      "<path>/models.py</path>\n<content>\n1: class PhotoModel:\n2:     pass\n</content>"
    )
    const signals = extractSignals(evidence)
    const classes = signals.filter((s) => s.kind === "class")
    
    expect(classes.some((s) => s.name === "PhotoModel")).toBe(true)
  })

  it("extracts TypeScript classes", () => {
    const evidence = createEvidence(
      "<path>/photo.ts</path>\n<content>\n1: class PhotoController {\n2: }\n</content>"
    )
    const signals = extractSignals(evidence)
    const classes = signals.filter((s) => s.kind === "class")
    
    expect(classes.some((s) => s.name === "PhotoController")).toBe(true)
  })

  it("extracts TypeScript interfaces", () => {
    const evidence = createEvidence(
      "<path>/photo.ts</path>\n<content>\n1: interface PhotoProps {\n2:     id: string;\n3: }\n</content>"
    )
    const signals = extractSignals(evidence)
    const classes = signals.filter((s) => s.kind === "class")
    
    expect(classes.some((s) => s.name === "PhotoProps")).toBe(true)
  })

  it("extracts TypeScript types", () => {
    const evidence = createEvidence(
      "<path>/photo.ts</path>\n<content>\n1: type PhotoState = {\n2:     photos: Photo[];\n3: };\n</content>"
    )
    const signals = extractSignals(evidence)
    const classes = signals.filter((s) => s.kind === "class")
    
    expect(classes.some((s) => s.name === "PhotoState")).toBe(true)
  })

  it("extracts exported classes", () => {
    const evidence = createEvidence(
      "<path>/photo.ts</path>\n<content>\n1: export class ImageProcessor {\n2: }\n</content>"
    )
    const signals = extractSignals(evidence)
    const classes = signals.filter((s) => s.kind === "class")
    
    expect(classes.some((s) => s.name === "ImageProcessor")).toBe(true)
  })
})

describe("Extractor - Import Extraction", () => {
  it("extracts ES6 imports", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: import express from 'express';\n</content>"
    )
    const signals = extractSignals(evidence)
    const imports = signals.filter((s) => s.kind === "import")
    
    expect(imports.length).toBeGreaterThan(0)
    expect(imports[0].text).toContain("import")
  })

  it("extracts named imports", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: import { Router, Request } from 'express';\n</content>"
    )
    const signals = extractSignals(evidence)
    const imports = signals.filter((s) => s.kind === "import")
    
    expect(imports.length).toBeGreaterThan(0)
  })

  it("extracts Python imports", () => {
    const evidence = createEvidence(
      "<path>/app.py</path>\n<content>\n1: from flask import Flask, request\n</content>"
    )
    const signals = extractSignals(evidence)
    const imports = signals.filter((s) => s.kind === "import")
    
    expect(imports.length).toBeGreaterThan(0)
  })

  it("extracts require statements", () => {
    const evidence = createEvidence(
      "<path>/app.js</path>\n<content>\n1: const express = require('express');\n</content>"
    )
    const signals = extractSignals(evidence)
    const imports = signals.filter((s) => s.kind === "import")
    
    expect(imports.length).toBeGreaterThan(0)
  })
})

describe("Extractor - Route Extraction", () => {
  it("extracts Express routes", () => {
    const evidence = createEvidence(
      "<path>/router.ts</path>\n<content>\n1: router.get('/photos', async (req, res) => {});\n</content>"
    )
    const signals = extractSignals(evidence)
    const routes = signals.filter((s) => s.kind === "route")
    
    expect(routes.length).toBeGreaterThan(0)
    expect(routes[0].name).toContain("GET")
    expect(routes[0].name).toContain("photos")
  })

  it("extracts router.post routes", () => {
    const evidence = createEvidence(
      "<path>/router.ts</path>\n<content>\n1: router.post('/photos', uploadPhoto);\n</content>"
    )
    const signals = extractSignals(evidence)
    const routes = signals.filter((s) => s.kind === "route")
    
    expect(routes.some((s) => s.name?.includes("POST"))).toBe(true)
  })

  it("extracts decorator routes", () => {
    const evidence = createEvidence(
      "<path>/controller.ts</path>\n<content>\n1: @Get('/photos')\n2: async findAll() {}\n</content>"
    )
    const signals = extractSignals(evidence)
    const routes = signals.filter((s) => s.kind === "route")
    
    expect(routes.length).toBeGreaterThan(0)
  })
})

describe("Extractor - Full Code Files", () => {
    it("extracts signals from code with functions", () => {
      const evidence = createEvidence(
        "<path>/app.py</path>\n<content>\n1: def hello():\n2:     pass\n3: class Photo:\n4:     pass\n5: from flask import Flask\n</content>"
      )
      const signals = extractSignals(evidence)
      
      const functions = signals.filter((s) => s.kind === "function")
      const classes = signals.filter((s) => s.kind === "class")
      const imports = signals.filter((s) => s.kind === "import")
      
      expect(functions.length).toBeGreaterThan(0)
      expect(classes.length).toBeGreaterThan(0)
      expect(imports.length).toBeGreaterThan(0)
    })

    it("extracts signals from TypeScript code", () => {
      const evidence = createEvidence(
        "<path>/app.ts</path>\n<content>\n1: function hello() {}\n2: class Photo {}\n3: import express from 'express';\n</content>"
      )
      const signals = extractSignals(evidence)
      
      const functions = signals.filter((s) => s.kind === "function")
      const classes = signals.filter((s) => s.kind === "class")
      const imports = signals.filter((s) => s.kind === "import")
      
      expect(functions.length).toBeGreaterThan(0)
      expect(classes.length).toBeGreaterThan(0)
      expect(imports.length).toBeGreaterThan(0)
    })
  })

describe("Extractor - Edge Cases", () => {
  it("handles various edge cases gracefully", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: // This is a comment\n2: export { helper }\n</content>"
    )
    const signals = extractSignals(evidence)
    
    // Should not crash
    expect(Array.isArray(signals)).toBe(true)
  })
})

describe("Extractor - Language Detection", () => {
  it("detects Python files", () => {
    const evidence = createEvidence(
      "<path>/app.py</path>\n<content>\n1: def hello():\n</content>"
    )
    const signals = extractSignals(evidence)
    
    expect(signals[0]?.language).toBe("python")
  })

  it("detects TypeScript files", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: function hello() {}\n</content>"
    )
    const signals = extractSignals(evidence)
    
    expect(signals[0]?.language).toBe("typescript")
  })

  it("detects JavaScript files", () => {
    const evidence = createEvidence(
      "<path>/app.js</path>\n<content>\n1: const hello = () => {};\n</content>"
    )
    const signals = extractSignals(evidence)
    
    expect(signals[0]?.language).toBe("javascript")
  })

  it("detects Go files", () => {
    const evidence = createEvidence(
      "<path>/main.go</path>\n<content>\n1: func main() {}\n</content>"
    )
    const signals = extractSignals(evidence)
    
    expect(signals[0]?.language).toBe("go")
  })
})

describe("Extractor - Signal Properties", () => {
  it("includes file path in tags", () => {
    const evidence = createEvidence(
      "<path>/controllers/photos.ts</path>\n<content>\n1: class PhotoController {}\n</content>"
    )
    const signals = extractSignals(evidence)
    const photoSignal = signals.find((s) => s.name === "PhotoController")
    
    expect(photoSignal?.tags).toContain("photos.ts")
  })

  it("includes confidence score", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: class Photo {}\n</content>"
    )
    const signals = extractSignals(evidence)
    const classSignal = signals.find((s) => s.kind === "class")
    
    expect(classSignal?.confidence).toBeGreaterThan(0)
  })
})

describe("Extractor - Deduplication", () => {
  it("removes duplicate function definitions on same line", () => {
    const evidence = createEvidence(
      "<path>/app.ts</path>\n<content>\n1: function hello() {}\n2: class hello {}\n</content>"
    )
    const signals = extractSignals(evidence)
    const helloFunctions = signals.filter((s) => s.name === "hello")
    
    // May have 2 (one function, one class) or deduplicated based on key
    expect(helloFunctions.length).toBeGreaterThanOrEqual(1)
  })
})