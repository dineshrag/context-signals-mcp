#!/bin/bash
# Simple LiteLLM Benchmark - Manual/Semi-automated
# Run in Ubuntu WSL shell directly

set -e

PROJECT_DIR="/home/dev/context-signals-mcp"
REPO_DIR="/home/dev/context-signals-mcp/benchmarks/repos/litellm-live"

echo "=============================================="
echo "SIMPLE LITELEMM BENCHMARK"
echo "Without MCP vs With MCP"
echo "=============================================="
echo ""

# Check prerequisites
if [ ! -d "$REPO_DIR" ]; then
    echo "ERROR: LiteLLM repo not found at $REPO_DIR"
    exit 1
fi

if [ ! -f "$PROJECT_DIR/dist/index.js" ]; then
    echo "ERROR: MCP server not built. Run 'npm run build' first."
    exit 1
fi

echo "Starting MCP server in background..."
cd "$PROJECT_DIR"
node dist/index.js &
MCP_PID=$!
sleep 3

echo "MCP server PID: $MCP_PID"
echo ""

# Define queries (one per line)
QUERIES=(
    "Find the main completion entry point for LiteLLM"
    "Trace where model configuration is merged before being sent to provider"
    "Find where provider routing happens based on model name"
    "Find where fallback model selection logic is implemented"
    "Find where retry logic with exponential backoff is implemented"
)

# Create output file
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULTS_FILE="$PROJECT_DIR/benchmarks/agent/v0.8/results/simple-benchmark-$TIMESTAMP.txt"

echo "Results will be saved to: $RESULTS_FILE"
echo ""
echo "==============================================" | tee -a "$RESULTS_FILE"
echo "SIMPLE LITELEMM BENCHMARK - NO MCP" | tee -a "$RESULTS_FILE"
echo "==============================================" | tee -a "$RESULTS_FILE"
echo "Date: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Run queries WITHOUT MCP
for i in "${!QUERIES[@]}"; do
    QUERY="${QUERIES[$i]}"
    TASK_NUM=$((i+1))
    echo "--- Task $TASK_NUM (NO MCP) ---" | tee -a "$RESULTS_FILE"
    echo "Query: $QUERY" | tee -a "$RESULTS_FILE"

    # Run opencode WITHOUT MCP
    opencode run "$QUERY" -m "opencode/minimax-m2.7" --session "no-mcp-$TASK_NUM" --dir "$REPO_DIR" 2>&1 | tee -a "$RESULTS_FILE"

    echo "" | tee -a "$RESULTS_FILE"
done

echo "==============================================" | tee -a "$RESULTS_FILE"
echo "SIMPLE LITELEMM BENCHMARK - WITH MCP" | tee -a "$RESULTS_FILE"
echo "==============================================" | tee -a "$RESULTS_FILE"
echo "Date: $(date)" | tee -a "$RESULTS_FILE"
echo "" | tee -a "$RESULTS_FILE"

# Run queries WITH MCP
for i in "${!QUERIES[@]}"; do
    QUERY="${QUERIES[$i]}"
    TASK_NUM=$((i+1))
    echo "--- Task $TASK_NUM (WITH MCP) ---" | tee -a "$RESULTS_FILE"
    echo "Query: $QUERY" | tee -a "$RESULTS_FILE"

    # Run opencode WITH MCP config
    opencode run "$QUERY" -m "opencode/minimax-m2.7" --session "with-mcp-$TASK_NUM" --config "$PROJECT_DIR/benchmarks/agent/v0.8/configs/opencode.with-mcp.jsonc" --dir "$REPO_DIR" 2>&1 | tee -a "$RESULTS_FILE"

    echo "" | tee -a "$RESULTS_FILE"
done

# Cleanup
echo "Stopping MCP server (PID: $MCP_PID)..."
kill $MCP_PID 2>/dev/null || true

echo ""
echo "=============================================="
echo "BENCHMARK COMPLETE"
echo "Results: $RESULTS_FILE"
echo "=============================================="