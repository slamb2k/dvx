#!/usr/bin/env sh
set -e

REPO="slamb2k/dvx"
VERSION="${DVX_VERSION:-latest}"

if [ "$VERSION" = "latest" ]; then
  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": *"//;s/".*//')
fi

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

# Only linux-x64, darwin-arm64, and win-x64 binaries are published.
# macOS x64 users should install via npm: npm install -g dvx
if [ "$OS" = "darwin" ] && [ "$ARCH" = "x64" ]; then
  echo "Pre-built binaries are only available for Apple Silicon (arm64)." >&2
  echo "Install via npm instead: npm install -g dvx" >&2
  exit 1
fi

FILENAME="dvx-${OS}-${ARCH}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${FILENAME}"
# Note: the release workflow must publish .sha256 files alongside zip artifacts.
SHA256_URL="${URL}.sha256"

TMPDIR=$(mktemp -d)
curl -fsSL "$URL" -o "${TMPDIR}/dvx.zip"
curl -fsSL "$SHA256_URL" -o "${TMPDIR}/dvx.zip.sha256"

# Verify checksum — the .sha256 file contains just the hash
EXPECTED=$(cat "${TMPDIR}/dvx.zip.sha256" | tr -d '[:space:]')
if [ "$OS" = "darwin" ]; then
  ACTUAL=$(shasum -a 256 "${TMPDIR}/dvx.zip" | cut -d' ' -f1)
else
  ACTUAL=$(sha256sum "${TMPDIR}/dvx.zip" | cut -d' ' -f1)
fi
[ "$EXPECTED" = "$ACTUAL" ] || { echo "Checksum verification failed (expected $EXPECTED, got $ACTUAL)" >&2; rm -rf "$TMPDIR"; exit 1; }

unzip -q "${TMPDIR}/dvx.zip" -d "${TMPDIR}"
install -m 755 "${TMPDIR}/dvx" /usr/local/bin/dvx
[ -f "${TMPDIR}/better_sqlite3.node" ] && install -m 755 "${TMPDIR}/better_sqlite3.node" /usr/local/lib/dvx-better-sqlite3.node
rm -rf "$TMPDIR"
echo "dvx ${VERSION} installed to /usr/local/bin/dvx"
