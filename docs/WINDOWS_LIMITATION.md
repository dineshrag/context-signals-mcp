# Windows OpenCode CLI Limitation

## Problem

On Windows, `opencode run` output cannot be captured programmatically via:
- Node.js `child_process.spawnSync()` / `execSync()`
- PowerShell `Start-Process` with `-Wait`
- `cmd /c "opencode run ..."` via any method
- `node-pty` (PTY emulator)

## Symptoms

1. **Zero-length stdout/stderr**: Commands execute (exit code 0), sessions are created, but no output is captured
2. **node-pty capture only metadata**: PTY captures INFO logs but not actual agent response text
3. **Interactive terminal works**: Running `opencode run` directly in an interactive terminal produces correct output

## Root Cause

The Windows opencode CLI uses a TTY-based rendering mechanism that outputs:
- DEBUG/INFO metadata to stderr (capturable)
- Actual response content to a different TTY stream that cannot be intercepted

This appears to be a Windows-specific issue with how opencode handles console output on Windows vs Linux.

## Evidence

| Method | Stdout | Stderr | Actual Response |
|--------|--------|--------|-----------------|
| Interactive terminal | ✓ | ✓ | ✓ captured |
| cmd /c via PowerShell | 0 bytes | 0 bytes | ✗ not captured |
| spawnSync shell:true | 0 bytes | INFO logs only | ✗ not captured |
| node-pty | n/a | INFO logs only | ✗ not captured |

## Impact

Automated benchmark execution (v0.8 Agent Navigation Benchmark) **cannot run on Windows**.

Sessions ARE created successfully - we verified via `opencode session list` that sessions are being created with correct content. The issue is purely with capturing output programmatically.

## Resolution

Run automated benchmarks on **WSL/Linux** where opencode CLI output can be properly captured.

## Status

- v0.8 benchmark framework: ✓ complete
- Tasks, configs, runner: ✓ ready
- Windows automated execution: ✗ blocked
- WSL/Linux automated execution: → see WSL_SETUP.md