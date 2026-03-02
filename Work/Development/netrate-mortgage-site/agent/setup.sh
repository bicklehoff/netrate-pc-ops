#!/bin/bash
# ─────────────────────────────────────────────────────────────
# NetRate Rate Agent — Ubuntu Setup Script
#
# Sets up:
#   1. Node.js 22 (via nvm)
#   2. OpenClaw (global install + daemon)
#   3. Rate pipeline scripts + dependencies
#   4. Folder structure (inbox, archive, output)
#   5. systemd service for the file watcher (optional)
#
# Usage:
#   curl -sL <this-script> | bash
#   # or:
#   chmod +x setup.sh && ./setup.sh
# ─────────────────────────────────────────────────────────────

set -e

RATES_DIR="$HOME/rates"
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  NetRate Mortgage — Rate Agent Setup"
echo "═══════════════════════════════════════════════════"
echo ""

# ── 1. Check/Install Node.js ────────────────────────────────

if command -v node &>/dev/null; then
  NODE_VER=$(node -v)
  log "Node.js found: $NODE_VER"
  MAJOR=$(echo "$NODE_VER" | sed 's/v//' | cut -d. -f1)
  if [ "$MAJOR" -lt 22 ]; then
    warn "Node.js $NODE_VER is too old. OpenClaw needs v22+."
    warn "Install nvm and run: nvm install 22"
    exit 1
  fi
else
  err "Node.js not found. Installing via nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install 22
  log "Node.js $(node -v) installed"
fi

# ── 2. Install OpenClaw ─────────────────────────────────────

if command -v openclaw &>/dev/null; then
  log "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'unknown version')"
else
  log "Installing OpenClaw..."
  npm install -g openclaw@latest
  log "OpenClaw installed"
fi

# ── 3. Set up rate pipeline ─────────────────────────────────

log "Setting up rate pipeline at $RATES_DIR"
mkdir -p "$RATES_DIR"/{inbox,archive,output}

# Copy scripts (if running from the repo)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/parse-amwest-xlsx.js" ]; then
  cp "$SCRIPT_DIR/parse-amwest-xlsx.js" "$RATES_DIR/"
  cp "$SCRIPT_DIR/upload-to-gcs.js" "$RATES_DIR/"
  cp "$SCRIPT_DIR/watcher.js" "$RATES_DIR/"
  log "Scripts copied to $RATES_DIR"
else
  warn "Scripts not found in $SCRIPT_DIR — copy them manually"
fi

# Install npm dependencies
cd "$RATES_DIR"
if [ ! -f package.json ]; then
  npm init -y --silent >/dev/null 2>&1
fi
npm install xlsx dotenv --silent 2>/dev/null
log "Dependencies installed (xlsx, dotenv)"

# ── 4. Environment file ─────────────────────────────────────

if [ ! -f "$RATES_DIR/.env" ]; then
  cat > "$RATES_DIR/.env" << 'ENVEOF'
# Google Cloud Storage — NetRate Rate Pipeline
GCS_BUCKET_NAME=netrate-rates

# Paste the FULL JSON contents of your GCS service account key below
# (the file: netrate-mortgage-7eed86359f46.json)
GCS_SERVICE_ACCOUNT_KEY=

ENVEOF
  warn "Created $RATES_DIR/.env — YOU MUST add your GCS_SERVICE_ACCOUNT_KEY"
  warn "Paste the contents of your service account JSON key file"
else
  log ".env already exists"
fi

# ── 5. OpenClaw skill ───────────────────────────────────────

SKILL_DIR="$HOME/.openclaw/workspace/skills/netrate-rates"
mkdir -p "$SKILL_DIR"
if [ -f "$SCRIPT_DIR/SKILL.md" ]; then
  cp "$SCRIPT_DIR/SKILL.md" "$SKILL_DIR/"
  log "OpenClaw skill installed at $SKILL_DIR"
else
  warn "SKILL.md not found — copy it to $SKILL_DIR manually"
fi

# ── 6. Optional: systemd watcher service ────────────────────

echo ""
read -p "Install systemd service for auto-watching? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  SERVICE_FILE="$HOME/.config/systemd/user/netrate-watcher.service"
  mkdir -p "$(dirname "$SERVICE_FILE")"

  cat > "$SERVICE_FILE" << SVCEOF
[Unit]
Description=NetRate Rate Sheet Watcher
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$RATES_DIR
ExecStart=$(which node) $RATES_DIR/watcher.js --watch 60
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
SVCEOF

  systemctl --user daemon-reload
  systemctl --user enable netrate-watcher
  systemctl --user start netrate-watcher
  log "Watcher service installed and started"
  log "Check status: systemctl --user status netrate-watcher"
  log "View logs:    journalctl --user -u netrate-watcher -f"
else
  log "Skipped systemd install. Run manually with:"
  log "  node $RATES_DIR/watcher.js --watch"
fi

# ── Done ─────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Setup complete!"
echo "═══════════════════════════════════════════════════"
echo ""
echo "  Next steps:"
echo "  1. Add your GCS service account key to $RATES_DIR/.env"
echo "  2. Run: openclaw onboard --install-daemon"
echo "  3. Drop an XLSX into $RATES_DIR/inbox/"
echo "  4. Or tell OpenClaw: 'update rates'"
echo ""
echo "  Test the pipeline manually:"
echo "    cp ratesheet.xlsx $RATES_DIR/inbox/"
echo "    node $RATES_DIR/watcher.js"
echo ""
