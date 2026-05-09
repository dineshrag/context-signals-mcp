# WSL/Linux Benchmark Setup

## Prerequisites

1. **WSL installed** with Ubuntu 20.04+ or Debian
2. **Node.js 18+** in WSL
3. **opencode CLI** installed in WSL
4. **npm dependencies** installed in the project

## Setup Steps

### 1. Verify WSL

```bash
wsl --status
wsl -d Ubuntu -- ls /
```

### 2. Install Node.js (if not present)

```bash
# In WSL
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should be 18+
npm --version
```

### 3. Install opencode in WSL

```bash
# In WSL
npm install -g opencode-ai
opencode --version  # Should be 1.14.41+
```

### 4. Install project dependencies

```bash
# In WSL, at project root
npm install
npm run build
```

### 5. Clone LiteLLM repo (if not present)

```bash
# In WSL
cd benchmarks/repos
git clone --depth 1 --branch v1.83.7-stable https://github.com/BerriAI/litellm.git litellm-live
```

## Dry Run Command

Test that opencode output capture works on Linux:

```bash
# In WSL, at project root
cd /path/to/context-signals-mcp

opencode run "Say hi" -m "opencode/minimax-m2.7" --session "linux-dryrun-001" --print-logs 2>&1 | head -50
```

**Expected**: Output should include "Hi" or "Hello" response (not just INFO logs)

If dry run succeeds, proceed with benchmark. If it fails, check opencode installation.

## Run Benchmark on WSL

```bash
# In WSL, at project root
cd /path/to/context-signals-mcp

# Run the benchmark
npx ts-node benchmarks/agent/v0.8/scripts/run-agent-benchmark.ts benchmarks/repos/litellm-live
```

## Expected Output on Success

```
============================================================
v0.8 AGENT NAVIGATION BENCHMARK
============================================================

Repo: benchmarks/repos/litellm-live
Tasks: 10
Modes: no-mcp, cs-deterministic, cs-embeddings
Repeats: 1
Model: opencode/minimax-m2.7
============================================================

Task: litellm-001 - Find the main completion entry point for LiteLLM...
  Running litellm-001 (no-mcp) run 1...
  no-mcp run 1: SUCCESS (5 files, 1 wrong, 1/1 expected found)
...
```

## Verification Checklist

- [ ] WSL accessible
- [ ] Node.js 18+ installed
- [ ] opencode CLI installed and version 1.14.41+
- [ ] npm install completed
- [ ] npm run build succeeded
- [ ] LiteLLM repo cloned at v1.83.7-stable
- [ ] Dry run captures actual response (not just logs)
- [ ] Benchmark runs to completion

## Troubleshooting

### opencode not found
```bash
npm install -g opencode-ai
hash -r  # Refresh command hash
```

### Permission denied on scripts
```bash
chmod +x benchmarks/agent/v0.8/scripts/*.sh
```

### Session export failing
```bash
# Ensure opencode CLI can access session store
opencode session list
```