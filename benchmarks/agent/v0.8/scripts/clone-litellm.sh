#!/bin/bash
# Clone LiteLLM repository at stable release tag
# Usage: ./clone-litellm.sh <target_dir>

set -e

TARGET_DIR="${1:-benchmarks/repos/litellm-live}"
REPO_URL="https://github.com/BerriAI/litellm.git"

echo "Cloning LiteLLM to $TARGET_DIR..."

# Get latest stable release tag
LATEST_TAG=$(git ls-remote --tags "$REPO_URL" 2>/dev/null | grep -v '\^{' | awk -F'/' '{print $3}' | sort -V | tail -n1)

if [ -z "$LATEST_TAG" ]; then
    echo "ERROR: Could not resolve latest release tag"
    exit 1
fi

echo "Latest stable release tag: $LATEST_TAG"

# Clone at specific tag
if [ -d "$TARGET_DIR" ]; then
    echo "Directory exists, removing old clone..."
    rm -rf "$TARGET_DIR"
fi

git clone --branch "$LATEST_TAG" --depth 1 "$REPO_URL" "$TARGET_DIR"

# Resolve actual commit SHA
COMMIT_SHA=$(git -C "$TARGET_DIR" rev-parse HEAD)

echo "Cloned successfully!"
echo "Tag: $LATEST_TAG"
echo "Commit SHA: $COMMIT_SHA"

# Write metadata
cat > "$TARGET_DIR/.benchmark-meta.json" << EOF
{
  "repo_url": "$REPO_URL",
  "release_tag": "$LATEST_TAG",
  "commit_sha": "$COMMIT_SHA",
  "cloned_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Metadata written to $TARGET_DIR/.benchmark-meta.json"