#!/usr/bin/env bash
#
# QwebBridge installer
#
# Usage:
#   curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash
#   curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash -s -- --no-start
#   curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash -s -- --no-skill
#   curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash -s -- --branch main
#
# What it does:
#   1. Check prerequisites (git, node >=18, pnpm)
#   2. Clone repo
#   3. Install dependencies and build
#   4. Start the daemon (unless --no-start)
#   5. Install skill to AI agent runtimes (unless --no-skill)

set -euo pipefail

REPO_URL="https://github.com/hu-qi/QWebBridge.git"
INSTALL_DIR="${QWEB_HOME:-$HOME/.qweb-bridge/repo}"
BIN_DIR="$HOME/.qweb-bridge/bin"

if [ -t 1 ]; then
  B=$'\033[1m'; G=$'\033[32m'; Y=$'\033[33m'; R=$'\033[31m'; N=$'\033[0m'
else
  B=""; G=""; Y=""; R=""; N=""
fi

info() { printf "%s==>%s %s\n" "$B" "$N" "$*"; }
ok()   { printf "%s✓%s %s\n" "$G" "$N" "$*"; }
warn() { printf "%s!%s %s\n" "$Y" "$N" "$*" >&2; }
err()  { printf "%s✗%s %s\n" "$R" "$N" "$*" >&2; }

show_help() {
  cat <<EOF
QwebBridge installer

Usage:
  curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash
  curl ... | bash -s -- --no-start    # skip daemon start
  curl ... | bash -s -- --no-skill    # skip skill install
  curl ... | bash -s -- --branch main # specific branch

Options:
  -h, --help       Show this help.
  --no-start       Install and build, but don't start the daemon.
  --no-skill       Install and start, but skip skill installation.
  --branch BRANCH  Git branch to clone (default: main).
EOF
}

NO_START=0
NO_SKILL=0
BRANCH="main"

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)    show_help; exit 0 ;;
    --no-start)   NO_START=1; shift ;;
    --no-skill)   NO_SKILL=1; shift ;;
    --branch)     BRANCH="$2"; shift 2 ;;
    *) err "unknown option: $1"; echo; show_help >&2; exit 2 ;;
  esac
done

# ---------- prerequisites ----------

info "Checking prerequisites..."

command -v git >/dev/null 2>&1 || { err "git is required"; exit 1; }

NODE_VERSION=$(node --version 2>/dev/null || echo "none")
if [ "$NODE_VERSION" = "none" ]; then
  err "Node.js >= 18 is required"
  exit 1
fi
ok "Node.js $NODE_VERSION"

if ! command -v pnpm >/dev/null 2>&1; then
  info "pnpm not found — installing via npm..."
  npm install -g pnpm >/dev/null 2>&1 || { err "failed to install pnpm"; exit 1; }
  ok "pnpm installed"
else
  ok "pnpm $(pnpm --version)"
fi

# ---------- clone / update ----------

if [ -d "$INSTALL_DIR" ]; then
  info "Updating existing installation at $INSTALL_DIR..."
  cd "$INSTALL_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  info "Cloning QwebBridge from $REPO_URL (branch: $BRANCH)..."
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repository ready at $INSTALL_DIR"

# ---------- create symlink ----------

mkdir -p "$BIN_DIR"
ln -sf "$INSTALL_DIR/node_modules/.bin/qweb-bridge" "$BIN_DIR/qweb-bridge" 2>/dev/null || true

# ---------- install dependencies ----------

cd "$INSTALL_DIR"
info "Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
ok "Dependencies installed"

info "Building..."
pnpm build
ok "Build complete"

# ---------- start daemon ----------

if [ "$NO_START" -eq 0 ]; then
  info "Starting daemon..."
  if node packages/daemon/dist/cli.js start; then
    ok "Daemon started"
  else
    warn "Daemon may need manual start: cd $INSTALL_DIR && node packages/daemon/dist/cli.js run"
  fi
else
  info "Skipping daemon start (--no-start)"
  info "  Start manually:  node packages/daemon/dist/cli.js run"
  info "  Or:              cd $INSTALL_DIR && node packages/daemon/dist/cli.js start"
fi

# ---------- install skill ----------

if [ "$NO_SKILL" -eq 0 ]; then
  info "Installing AI agent skill..."
  cd "$INSTALL_DIR"
  bash packages/skill/install.sh
  ok "Skill installed"
else
  info "Skipping skill install (--no-skill)"
  info "  Install manually: bash $INSTALL_DIR/packages/skill/install.sh"
fi

printf "\n%s✓%s QwebBridge installed!%s\n" "$G" "$N" "$B"
printf "  Status:  cd %s && node packages/daemon/dist/cli.js status\n" "$INSTALL_DIR"
printf "  Start:   cd %s && node packages/daemon/dist/cli.js run\n" "$INSTALL_DIR"
printf "  Help:    cd %s && node packages/daemon/dist/cli.js\n" "$INSTALL_DIR"
