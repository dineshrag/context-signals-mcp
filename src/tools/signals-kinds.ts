export type SignalKind =
  | "file"
  | "import"
  | "export"
  | "function"
  | "class"
  | "interface"
  | "type"
  | "component"
  | "route"
  | "middleware"
  | "symbol"
  | "diagnostic"

export function getKinds(): SignalKind[] {
  return [
    "file",
    "import",
    "export",
    "function",
    "class",
    "interface",
    "type",
    "component",
    "route",
    "middleware",
    "symbol",
    "diagnostic",
  ]
}