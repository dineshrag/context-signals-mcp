import ts from "typescript"
import { createSignal } from "../../types/signal.js"

type Signal = ReturnType<typeof createSignal>

export interface ExtractionResult {
  signals: Signal[]
  errors: string[]
}

const LANGUAGE = "typescript" as const

export function extractTypeScript(content: string, file: string, evidenceId: string): ExtractionResult {
  const signals: Signal[] = []
  const errors: string[] = []

  try {
    const sourceFile = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    walkAST(sourceFile, evidenceId, file, signals)
  } catch (error) {
    errors.push(`Failed to parse TypeScript: ${error}`)
  }

  return { signals, errors }
}

function walkAST(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  extractNode(node, evidenceId, file, signals)
  ts.forEachChild(node, (child) => walkAST(child, evidenceId, file, signals))
}

function extractNode(node: ts.Node, evidenceId: string, file: string, signals: Signal[]): void {
  const handler = handlers[node.kind]
  if (handler) {
    handler(node, evidenceId, file, signals)
  }
}

type Handler = (node: ts.Node, evidenceId: string, file: string, signals: Signal[]) => void

const handlers: Partial<Record<ts.SyntaxKind, Handler>> = {
  [ts.SyntaxKind.ImportDeclaration]: (n, eid, f, s) => extractImport(n as ts.ImportDeclaration, eid, f, s),
  [ts.SyntaxKind.ImportEqualsDeclaration]: (n, eid, f, s) => extractImportEquals(n as ts.ImportEqualsDeclaration, eid, f, s),
  [ts.SyntaxKind.ExportDeclaration]: (n, eid, f, s) => extractExport(n as ts.ExportDeclaration, eid, f, s),
  [ts.SyntaxKind.ExportAssignment]: (n, eid, f, s) => extractExportAssignment(n as ts.ExportAssignment, eid, f, s),
  [ts.SyntaxKind.FunctionDeclaration]: (n, eid, f, s) => extractFunctionDeclaration(n as ts.FunctionDeclaration, eid, f, s),
  [ts.SyntaxKind.ArrowFunction]: (n, eid, f, s) => extractArrowFunction(n as ts.ArrowFunction, eid, f, s),
  [ts.SyntaxKind.VariableStatement]: (n, eid, f, s) => extractVariableStatement(n as ts.VariableStatement, eid, f, s),
  [ts.SyntaxKind.ClassDeclaration]: (n, eid, f, s) => extractClassDeclaration(n as ts.ClassDeclaration, eid, f, s),
  [ts.SyntaxKind.InterfaceDeclaration]: (n, eid, f, s) => extractInterfaceDeclaration(n as ts.InterfaceDeclaration, eid, f, s),
  [ts.SyntaxKind.TypeAliasDeclaration]: (n, eid, f, s) => extractTypeAliasDeclaration(n as ts.TypeAliasDeclaration, eid, f, s),
  [ts.SyntaxKind.EnumDeclaration]: (n, eid, f, s) => extractEnumDeclaration(n as ts.EnumDeclaration, eid, f, s),
  [ts.SyntaxKind.MethodDeclaration]: (n, eid, f, s) => extractMethodDeclaration(n as ts.MethodDeclaration, eid, f, s),
  [ts.SyntaxKind.GetAccessor]: (n, eid, f, s) => extractGetAccessor(n as ts.GetAccessorDeclaration, eid, f, s),
  [ts.SyntaxKind.SetAccessor]: (n, eid, f, s) => extractSetAccessor(n as ts.SetAccessorDeclaration, eid, f, s),
  [ts.SyntaxKind.PropertyDeclaration]: (n, eid, f, s) => extractPropertyDeclaration(n as ts.PropertyDeclaration, eid, f, s),
  [ts.SyntaxKind.ModuleDeclaration]: (n, eid, f, s) => extractModuleDeclaration(n as ts.ModuleDeclaration, eid, f, s),
  [ts.SyntaxKind.NamespaceExport]: (n, eid, f, s) => extractNamespaceExport(n as ts.NamespaceExport, eid, f, s),
  [ts.SyntaxKind.Decorator]: (n, eid, f, s) => extractDecorator(n as ts.Decorator, eid, f, s),
}

function getDeclarationName(node: ts.Declaration): string | undefined {
  const name = (node as any).name
  if (name && ts.isIdentifier(name)) {
    return name.text
  }
  return undefined
}

function extractImport(node: ts.ImportDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const moduleName = getModuleName(node.moduleSpecifier)
  if (!moduleName) return

  const namedBindings = node.importClause?.namedBindings
  let importName: string | undefined
  let namedImports: string[] = []

  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    importName = namedBindings.name.text
  } else if (namedBindings && ts.isNamedImports(namedBindings)) {
    namedImports = namedBindings.elements.map((e) => e.name.text)
  }

  if (node.importClause?.name) {
    importName = node.importClause.name.text
  }

  const text = namedImports.length > 0
    ? `import { ${namedImports.join(", ")} } from '${moduleName}'`
    : importName
      ? `import ${importName} from '${moduleName}'`
      : `import '${moduleName}'`

  signals.push(createSignal({
    evidenceId,
    kind: "import",
    language: LANGUAGE,
    file,
    text,
    tags: ["import", moduleName, ...namedImports],
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractImportEquals(node: ts.ImportEqualsDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const moduleRef = node.moduleReference
  let moduleName = ""

  if (ts.isExternalModuleReference(moduleRef)) {
    moduleName = getModuleName(moduleRef.expression) ?? ""
  } else if (ts.isIdentifier(moduleRef)) {
    moduleName = moduleRef.text
  }

  signals.push(createSignal({
    evidenceId,
    kind: "import",
    language: LANGUAGE,
    file,
    name,
    text: `import ${name} = require('${moduleName}')`,
    tags: ["import", "require", moduleName],
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractExport(node: ts.ExportDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const moduleName = node.moduleSpecifier ? getModuleName(node.moduleSpecifier) : undefined

  if (node.exportClause && ts.isNamedExports(node.exportClause)) {
    const exports = node.exportClause.elements.map((e) => e.name.text)
    signals.push(createSignal({
      evidenceId,
      kind: "export",
      language: LANGUAGE,
      file,
      text: moduleName ? `export { ${exports.join(", ")} } from '${moduleName}'` : `export { ${exports.join(", ")} }`,
      tags: ["export", ...exports, moduleName ?? ""],
      confidence: 0.95,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  } else if (moduleName) {
    signals.push(createSignal({
      evidenceId,
      kind: "export",
      language: LANGUAGE,
      file,
      text: `export * from '${moduleName}'`,
      tags: ["export", "re-export", moduleName],
      confidence: 0.95,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  }
}

function extractExportAssignment(node: ts.ExportAssignment, evidenceId: string, file: string, signals: Signal[]): void {
  if (node.isExportEquals) {
    const moduleRef = node.expression
    let moduleName = ts.isIdentifier(moduleRef) ? moduleRef.text : ""
    signals.push(createSignal({
      evidenceId,
      kind: "export",
      language: LANGUAGE,
      file,
      name: moduleName,
      text: `export = ${moduleName}`,
      tags: ["export", "module-exports", moduleName],
      confidence: 0.9,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  } else {
    const exprText = node.expression.getText()
    signals.push(createSignal({
      evidenceId,
      kind: "export",
      language: LANGUAGE,
      file,
      text: `export default ${exprText}`,
      tags: ["export", "default-export"],
      confidence: 0.95,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  }
}

function extractFunctionDeclaration(node: ts.FunctionDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name || isBuiltinFunction(name)) return

  const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword)
  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword)
  const isDefault = hasModifier(node, ts.SyntaxKind.DefaultKeyword)

  signals.push(createSignal({
    evidenceId,
    kind: "function",
    language: LANGUAGE,
    file,
    name,
    text: `${isAsync ? "async " : ""}function ${name}(...)`,
    tags: ["function", name, isAsync ? "async" : "", isExport ? "export" : "", isDefault ? "default" : ""].filter(Boolean),
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractArrowFunction(node: ts.ArrowFunction, evidenceId: string, file: string, signals: Signal[]): void {
  const parent = node.parent
  if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
    const name = parent.name.text
    if (isBuiltinFunction(name)) return

    const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword)
    signals.push(createSignal({
      evidenceId,
      kind: "function",
      language: LANGUAGE,
      file,
      name,
      text: `const ${name} = ${isAsync ? "async " : ""}(...) => ...`,
      tags: ["function", "arrow", name, isAsync ? "async" : ""].filter(Boolean),
      confidence: 0.9,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  }
}

function extractVariableStatement(node: ts.VariableStatement, evidenceId: string, file: string, signals: Signal[]): void {
  for (const decl of node.declarationList.declarations) {
    if (!ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name)) continue
    const varName = decl.name.text
    if (isBuiltinFunction(varName)) continue

    if (decl.initializer && ts.isFunctionExpression(decl.initializer)) {
      signals.push(createSignal({
        evidenceId,
        kind: "function",
        language: LANGUAGE,
        file,
        name: varName,
        text: `const ${varName} = function(...) { ... }`,
        tags: ["function", varName, "function-expression"],
        confidence: 0.9,
        lineStart: node.getStart(),
        lineEnd: node.end,
      }))
    }
  }
}

function extractClassDeclaration(node: ts.ClassDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword)
  const isAbstract = hasModifier(node, ts.SyntaxKind.AbstractKeyword)

  const heritage: string[] = []
  if (node.heritageClauses) {
    for (const clause of node.heritageClauses) {
      for (const typeRef of clause.types) {
        const text = typeRef.expression.getText()
        if (text) heritage.push(text)
      }
    }
  }

  signals.push(createSignal({
    evidenceId,
    kind: "class",
    language: LANGUAGE,
    file,
    name,
    text: `class ${name}${heritage.length > 0 ? ` extends ${heritage.join(", ")}` : ""}`,
    tags: ["class", name, isExport ? "export" : "", isAbstract ? "abstract" : "", ...heritage].filter(Boolean),
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractInterfaceDeclaration(node: ts.InterfaceDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword)
  signals.push(createSignal({
    evidenceId,
    kind: "interface",
    language: LANGUAGE,
    file,
    name,
    text: `interface ${name}`,
    tags: ["interface", name, isExport ? "export" : ""].filter(Boolean),
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractTypeAliasDeclaration(node: ts.TypeAliasDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword)
  signals.push(createSignal({
    evidenceId,
    kind: "type",
    language: LANGUAGE,
    file,
    name,
    text: `type ${name} = ...`,
    tags: ["type", name, isExport ? "export" : ""].filter(Boolean),
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractEnumDeclaration(node: ts.EnumDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const isExport = hasModifier(node, ts.SyntaxKind.ExportKeyword)
  const isConst = hasModifier(node, ts.SyntaxKind.ConstKeyword)

  signals.push(createSignal({
    evidenceId,
    kind: "class",
    language: LANGUAGE,
    file,
    name,
    text: isConst ? `const enum ${name}` : `enum ${name}`,
    tags: ["enum", name, isExport ? "export" : "", isConst ? "const" : ""].filter(Boolean),
    confidence: 0.95,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractMethodDeclaration(node: ts.MethodDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name || name === "constructor") return

  const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword)
  const isStatic = hasModifier(node, ts.SyntaxKind.StaticKeyword)

  signals.push(createSignal({
    evidenceId,
    kind: "function",
    language: LANGUAGE,
    file,
    name,
    text: `${isStatic ? "static " : ""}${isAsync ? "async " : ""}${name}(...)`,
    tags: ["method", name, isAsync ? "async" : "", isStatic ? "static" : ""].filter(Boolean),
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractGetAccessor(node: ts.GetAccessorDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  signals.push(createSignal({
    evidenceId,
    kind: "function",
    language: LANGUAGE,
    file,
    name,
    text: `get ${name}`,
    tags: ["getter", name],
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractSetAccessor(node: ts.SetAccessorDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  signals.push(createSignal({
    evidenceId,
    kind: "function",
    language: LANGUAGE,
    file,
    name,
    text: `set ${name}`,
    tags: ["setter", name],
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractPropertyDeclaration(node: ts.PropertyDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  const isStatic = hasModifier(node, ts.SyntaxKind.StaticKeyword)
  const isReadonly = hasModifier(node, ts.SyntaxKind.ReadonlyKeyword)

  signals.push(createSignal({
    evidenceId,
    kind: "class",
    language: LANGUAGE,
    file,
    name,
    text: `${isReadonly ? "readonly " : ""}${isStatic ? "static " : ""}${name}`,
    tags: ["property", name, isStatic ? "static" : "", isReadonly ? "readonly" : ""].filter(Boolean),
    confidence: 0.85,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractModuleDeclaration(node: ts.ModuleDeclaration, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  signals.push(createSignal({
    evidenceId,
    kind: "class",
    language: LANGUAGE,
    file,
    name: String(name),
    text: `namespace ${name}`,
    tags: ["namespace", String(name)],
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractNamespaceExport(node: ts.NamespaceExport, evidenceId: string, file: string, signals: Signal[]): void {
  const name = getDeclarationName(node)
  if (!name) return

  signals.push(createSignal({
    evidenceId,
    kind: "export",
    language: LANGUAGE,
    file,
    name,
    text: `export namespace ${name}`,
    tags: ["export", "namespace", name],
    confidence: 0.9,
    lineStart: node.getStart(),
    lineEnd: node.end,
  }))
}

function extractDecorator(node: ts.Decorator, evidenceId: string, file: string, signals: Signal[]): void {
  const text = node.getText()
  if (text.startsWith("@") && text.length > 1) {
    const decoratorName = text.slice(1).split("(")[0].trim()
    signals.push(createSignal({
      evidenceId,
      kind: "function",
      language: LANGUAGE,
      file,
      name: decoratorName,
      text: `@${decoratorName}(...)`,
      tags: ["decorator", decoratorName],
      confidence: 0.8,
      lineStart: node.getStart(),
      lineEnd: node.end,
    }))
  }
}

function getModuleName(expr: ts.Expression): string | undefined {
  if (ts.isStringLiteral(expr)) return expr.text
  if (ts.isIdentifier(expr)) return expr.text
  return undefined
}

function hasModifier(node: ts.Node, modifierKind: ts.SyntaxKind): boolean {
  if (!ts.canHaveModifiers(node)) return false
  const modifiers = ts.getModifiers(node)
  return modifiers?.some((m) => m.kind === modifierKind) ?? false
}

function isBuiltinFunction(name: string): boolean {
  const builtins = ["console", "JSON", "Math", "Date", "Array", "Object", "String", "Number", "Boolean", "Promise", "Map", "Set", "WeakMap", "WeakSet", "Proxy", "Reflect", "Symbol", "Error", "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURI", "decodeURI", "setTimeout", "setInterval", "clearTimeout", "clearInterval", "require", "module", "exports", "__dirname", "__filename", "HTTPException", "len", "open", "response", "request"]
  return builtins.includes(name)
}

export function detectReactComponent(content: string, file: string): boolean {
  if (!file.endsWith(".tsx") && !file.endsWith(".jsx")) return false
  return /(?:export\s+(?:default\s+)?|function\s+|const\s+\w+\s*=)\s*(?:React\.)?function|class\s+\w+/.test(content) || /return\s*\(|<[A-Z]|jsx\s*\(|createElement\s*\(/.test(content)
}