#!/usr/bin/env bash
#
# install.sh - Install QwebBridge skill for AI agents
#
# Copies the qweb-bridge skill to the agent skills directory, making
# it available for AI agents to discover and use.
#
# Usage:
#   install.sh                        # install to default location
#   install.sh --dest ~/.claude/skills  # install for Claude Code
#
# Default destination: ~/.agents/skills/

set -euo pipefail

SKILL_SOURCE="$(cd "$(dirname "$0")" && pwd)/qweb-bridge"
DEFAULT_DEST="${HOME}/.agents/skills"
DEST="${DEFAULT_DEST}"

usage() {
  cat <<EOF
Usage: $(basename "$0") [OPTIONS]

Install the QwebBridge skill for AI agent discovery.

Options:
  --dest DIR    Target skills directory (default: ~/.agents/skills/)
  -h, --help    Show this help

The skill is installed to: <dest>/qweb-bridge/
EOF
  exit 0
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest) DEST="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown option: $1"; usage ;;
  esac
done

mkdir -p "$DEST"

if [[ -d "${DEST}/qweb-bridge" ]]; then
  echo "Updating existing QwebBridge skill at ${DEST}/qweb-bridge ..."
  rm -rf "${DEST}/qweb-bridge"
fi

cp -R "$SKILL_SOURCE" "${DEST}/qweb-bridge"
chmod +x "${DEST}/qweb-bridge/scripts/screenshot.sh"

echo "✓ QwebBridge skill installed to ${DEST}/qweb-bridge/"
echo "  It is now available for AI agents to discover and use."
