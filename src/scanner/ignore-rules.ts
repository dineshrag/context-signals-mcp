export const DEFAULT_IGNORED_FOLDERS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "out",
  "coverage",
  ".cache",
  "turbo",
  "vendor",
  ".svn",
  "__pycache__",
  "venv",
  ".venv",
  "env",
]

export const DEFAULT_SUPPORTED_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".java",
  ".rb",
  ".php",
  ".rs",
  ".swift",
  ".kt",
]

export interface IgnoreRules {
  ignoredFolders: string[]
  supportedExtensions: string[]
  maxFileSizeBytes: number
}

export function createIgnoreRules(custom?: Partial<IgnoreRules>): IgnoreRules {
  return {
    ignoredFolders: custom?.ignoredFolders ?? DEFAULT_IGNORED_FOLDERS,
    supportedExtensions: custom?.supportedExtensions ?? DEFAULT_SUPPORTED_EXTENSIONS,
    maxFileSizeBytes: custom?.maxFileSizeBytes ?? 10 * 1024 * 1024,
  }
}

export function shouldIgnoreFolder(name: string, rules: IgnoreRules): boolean {
  return rules.ignoredFolders.includes(name) || name.startsWith(".")
}

export function isSupportedFile(filename: string, rules: IgnoreRules): boolean {
  const ext = getExtension(filename)
  return rules.supportedExtensions.includes(ext)
}

export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  if (lastDot === -1 || lastDot === filename.length - 1) return ""
  return filename.slice(lastDot)
}