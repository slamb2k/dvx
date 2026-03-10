#!/bin/sh
# dvx — Agent-first CLI for Microsoft Dataverse
# Install: curl -fsSL https://raw.githubusercontent.com/slamb2k/dvx/main/install.sh | sh
set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
RESET="\033[0m"

info() { printf "${BOLD}%s${RESET}\n" "$1"; }
success() { printf "${GREEN}%s${RESET}\n" "$1"; }
fail() { printf "${RED}Error: %s${RESET}\n" "$1"; exit 1; }

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  fail "Node.js 18+ is required. Install from https://nodejs.org"
fi

NODE_VERSION=$(node -e "console.log(process.version.slice(1).split('.')[0])")
if [ "$NODE_VERSION" -lt 18 ] 2>/dev/null; then
  fail "Node.js 18+ required (found v$NODE_VERSION). Update from https://nodejs.org"
fi

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
  fail "npm is required. Install Node.js from https://nodejs.org"
fi

info "Installing dvx-cli..."
npm install -g dvx-cli

success ""
success "  dvx installed successfully!"
success ""
info "  Quick start:"
echo "    dvx auth login          # Sign in to Dataverse"
echo "    dvx entities            # List all entities"
echo "    dvx demo --tier read    # Interactive capability showcase"
echo ""
info "  MCP server (for AI agents):"
echo "    dvx mcp --entities account,contact"
echo ""
