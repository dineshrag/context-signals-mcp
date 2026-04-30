import path from "path"

export interface Config {
  worktree: string
  memoryDir: string
  maxFileSizeBytes: number
  ignoredFolders: string[]
  supportedExtensions: string[]
  lspEnabled: boolean
}

export function createConfig(worktree?: string): Config {
  const wt = worktree ?? process.env.WORKTREE ?? process.cwd()
  return {
    worktree: wt,
    memoryDir: path.join(wt, ".crush-memory", "signals"),
    maxFileSizeBytes: 10 * 1024 * 1024,
    ignoredFolders: [
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
    ],
    supportedExtensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    lspEnabled: false,
  }
}

let globalConfig: Config | null = null

export function getConfig(worktree?: string): Config {
  if (!globalConfig) {
    globalConfig = createConfig(worktree)
  }
  return globalConfig
}

export function setConfig(config: Config): void {
  globalConfig = config
}