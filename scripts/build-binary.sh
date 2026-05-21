#!/usr/bin/env bash
#
# Build standalone qweb-bridge binary for distribution.
# Requires: npm install -g @yao-pkg/pkg
#
# Usage: bash scripts/build-binary.sh
#
# Output: packages/daemon/dist-sea/qweb-bridge

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building daemon..."
pnpm --filter @qweb/daemon build

echo "==> Building standalone binary..."
pnpm --filter @qweb/daemon build:binary

echo "==> Done"
ls -lh packages/daemon/dist-sea/qweb-bridge
