#!/bin/bash
# Step-by-step manual benchmark
# Run in Ubuntu WSL shell

PROJECT_DIR="/home/dev/context-signals-mcp"
REPO_DIR="/home/dev/context-signals-mcp/benchmarks/repos/litellm-live"

echo "=============================================="
echo "LITELEMM BENCHMARK - STEP BY STEP"
echo "=============================================="
echo ""

# Start MCP server
echo "Step 1: Starting MCP server..."
cd "$PROJECT_DIR"
node dist/index.js &
MCP_PID=$!
echo "MCP running on PID: $MCP_PID"
sleep 3

echo ""
echo "=============================================="
echo "QUERIES TO RUN:"
echo "=============================================="
echo ""
echo "1. Find the main completion entry point for LiteLLM"
echo "2. Trace where model configuration is merged before being sent to provider"
echo "3. Find where provider routing happens based on model name"
echo "4. Find where fallback model selection logic is implemented"
echo "5. Find where retry logic with exponential backoff is implemented"
echo ""
echo "=============================================="
echo ""
echo "Run these commands in the Ubuntu shell:"
echo ""
echo "WITHOUT MCP:"
for i in 1 2 3 4 5; do
    echo "opencode run \"<query $i>\" -m \"opencode/minimax-m2.7\" --session \"no-mcp-$i\" --dir \"$REPO_DIR\""
done
echo ""
echo "WITH MCP:"
for i in 1 2 3 4 5; do
    echo "opencode run \"<query $i>\" -m \"opencode/minimax-m2.7\" --session \"with-mcp-$i\" --config \"$PROJECT_DIR/benchmarks/agent/v0.8/configs/opencode.with-mcp.jsonc\" --dir \"$REPO_DIR\""
done
echo ""
echo "=============================================="
echo "After running, run: kill $MCP_PID"
echo "=============================================="