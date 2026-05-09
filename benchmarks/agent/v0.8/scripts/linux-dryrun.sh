#!/bin/bash
# Linux dry-run to verify opencode output capture
# Run this BEFORE running the benchmark on WSL/Linux

set -e

echo "=== OpenCode Linux Dry Run ==="
echo ""

cd "$(dirname "$0")/../../.."

echo "Running: opencode run 'Say hi' -m 'opencode/minimax-m2.7' --session 'linux-dryrun-001' --print-logs"
echo ""

OUTPUT=$(opencode run "Say hi" -m "opencode/minimax-m2.7" --session "linux-dryrun-001" --print-logs 2>&1)

echo "$OUTPUT" | head -20

echo ""
echo "=== Checking for actual response ==="

if echo "$OUTPUT" | grep -qi "hi\|hello"; then
    echo "SUCCESS: Actual response captured!"
    echo "Linux opencode capture is working."
    exit 0
else
    echo "FAILURE: No response captured (only logs)"
    echo "Check opencode installation on Linux."
    exit 1
fi