#!/usr/bin/env bash
#
# QwebBridge installer
#
# Usage:
#   curl -fsSL https://github.com/hu-qi/QWebBridge/raw/main/install.sh | bash
#   curl ... | bash -s -- --binary          # download pre-built binary (fast)
#   curl ... | bash -s -- --no-start        # skip daemon start
#   curl ... | bash -s -- --no-skill        # skip skill install
#
# What it does:
#   1. Detect platform
#   2. Download pre-built binary OR clone repo + build from source
#   3. Start the daemon (unless --no-start)
#   4. Install skill to AI agent runtimes (unless --no-skill)

set -euo pipefail

REPO="hu-qi/QWebBridge"
INSTALL_DIR="${QWEB_HOME:-$HOME/.qweb-bridge}"
BIN_DIR="$INSTALL_DIR/bin"
REPO_DIR="$INSTALL_DIR/repo"
SKILL_DIR="$INSTALL_DIR/skill"
VERSION="${QWEB_VERSION:-latest}"

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
  curl ... | bash -s -- --binary   # download pre-built binary
  curl ... | bash -s -- --no-start # skip daemon start
  curl ... | bash -s -- --no-skill # skip skill install

Options:
  -h, --help       Show this help.
  --binary         Download pre-built binary instead of building from source.
  --no-start       Install and build, but don't start the daemon.
  --no-skill       Install and start, but skip skill installation.
EOF
}

NO_START=0
NO_SKILL=0
USE_BINARY=0

while [ $# -gt 0 ]; do
  case "$1" in
    -h|--help)    show_help; exit 0 ;;
    --binary)     USE_BINARY=1; shift ;;
    --no-start)   NO_START=1; shift ;;
    --no-skill)   NO_SKILL=1; shift ;;
    *) err "unknown option: $1"; echo; show_help >&2; exit 2 ;;
  esac
done

# ---------- detect platform ----------

info "Detecting platform..."
case "$(uname -s)" in
  Darwin) OS="darwin" ;;
  Linux)  OS="linux" ;;
  *) err "unsupported OS: $(uname -s). Supported: macOS, Linux."; exit 1 ;;
esac

case "$(uname -m)" in
  arm64|aarch64) ARCH="arm64" ;;
  x86_64|amd64)  ARCH="amd64" ;;
  *) err "unsupported arch: $(uname -m). Supported: arm64, amd64."; exit 1 ;;
esac

PLATFORM="$OS-$ARCH"
ok "Platform: $PLATFORM"

# ---------- binary install ----------

if [ "$USE_BINARY" -eq 1 ]; then
  info "Downloading pre-built binary for $PLATFORM..."
  mkdir -p "$BIN_DIR"

  if [ "$VERSION" = "latest" ]; then
    API_URL="https://api.github.com/repos/$REPO/releases/latest"
    BIN_URL=$(curl -s "$API_URL" \
      | grep "browser_download_url.*qweb-bridge-$PLATFORM\"" \
      | cut -d'"' -f4 | head -1)
    if [ -z "$BIN_URL" ]; then
      err "No binary found for $PLATFORM. Falling back to source build."
      USE_BINARY=0
    fi
  else
    BIN_URL="https://github.com/$REPO/releases/download/$VERSION/qweb-bridge-$PLATFORM"
  fi

  if [ "$USE_BINARY" -eq 1 ]; then
    BIN_PATH="$BIN_DIR/qweb-bridge"
    TMP_BIN=$(mktemp)
    if ! curl -fsSL --retry 3 --connect-timeout 10 -o "$TMP_BIN" "$BIN_URL"; then
      err "failed to download binary from $BIN_URL"
      rm -f "$TMP_BIN"
      exit 1
    fi
    mv "$TMP_BIN" "$BIN_PATH"
    chmod +x "$BIN_PATH"
    ok "Binary installed to $BIN_PATH"

    # Copy skill files alongside binary
    mkdir -p "$SKILL_DIR"
    cat > "$SKILL_DIR/install.sh" << 'SKILLEOF'
#!/usr/bin/env bash
set -euo pipefail
SKILL_SOURCE="$(cd "$(dirname "$0")" && pwd)/qweb-bridge"
DEST="${HOME}/.agents/skills"
mkdir -p "$DEST"
if [ -d "${DEST}/qweb-bridge" ]; then rm -rf "${DEST}/qweb-bridge"; fi
cp -R "$SKILL_SOURCE" "${DEST}/qweb-bridge"
chmod +x "${DEST}/qweb-bridge/scripts/screenshot.sh"
echo "✓ QwebBridge skill installed to ${DEST}/qweb-bridge/"
SKILLEOF
    chmod +x "$SKILL_DIR/install.sh"

    BINARY="$BIN_PATH"
    install_skill_cmd="$BINARY install-skill"
  fi
fi

# ---------- source install ----------

if [ "$USE_BINARY" -eq 0 ]; then
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

  if [ -d "$REPO_DIR" ]; then
    info "Updating existing installation..."
    cd "$REPO_DIR"
    git fetch origin
    git pull origin main
  else
    info "Cloning QwebBridge..."
    mkdir -p "$(dirname "$REPO_DIR")"
    git clone --depth 1 https://github.com/$REPO.git "$REPO_DIR"
  fi
  ok "Repository ready at $REPO_DIR"

  cd "$REPO_DIR"
  info "Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  ok "Dependencies installed"

  info "Building..."
  pnpm build
  ok "Build complete"

  mkdir -p "$BIN_DIR"
  ln -sf "$REPO_DIR/node_modules/.bin/qweb-bridge" "$BIN_DIR/qweb-bridge" 2>/dev/null || true
  BINARY="$REPO_DIR/node_modules/.bin/qweb-bridge"

  # Use repo's skill
  install_skill_cmd="bash $REPO_DIR/packages/skill/install.sh"
fi

# ---------- start daemon ----------

if [ "$NO_START" -eq 0 ]; then
  info "Starting daemon..."
  if "$BINARY" start; then
    ok "Daemon started"
  else
    warn "Daemon may need manual start: $BINARY run"
  fi
else
  info "Skipping daemon start (--no-start)"
  info "  Start manually: $BINARY run"
fi

# ---------- install skill ----------

if [ "$NO_SKILL" -eq 0 ]; then
  info "Installing AI agent skill..."
  if eval "$install_skill_cmd"; then
    ok "Skill installed"
  else
    warn "Skill installation failed"
  fi
else
  info "Skipping skill install (--no-skill)"
  info "  Install manually: $install_skill_cmd"
fi

printf "\n%s✓%s QwebBridge installed!%s\n" "$G" "$N" "$B"
printf "  Binary: %s\n" "$BINARY"
printf "  Status: %s status\n" "$BINARY"
printf "  Start:  %s run\n" "$BINARY"
