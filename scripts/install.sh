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

FILENAME="dvx-${OS}-${ARCH}.zip"
URL="https://github.com/${REPO}/releases/download/${VERSION}/${FILENAME}"
# Note: the release workflow must publish .sha256 files alongside zip artifacts.
SHA256_URL="${URL}.sha256"

TMPDIR=$(mktemp -d)
curl -fsSL "$URL" -o "${TMPDIR}/dvx.zip"
curl -fsSL "$SHA256_URL" -o "${TMPDIR}/dvx.zip.sha256"

# Rewrite the checksum file to reference the local filename so the verify tool
# can find it regardless of how the digest was originally recorded.
sed -i "s|.*|$(cut -d' ' -f1 "${TMPDIR}/dvx.zip.sha256")  ${TMPDIR}/dvx.zip|" "${TMPDIR}/dvx.zip.sha256"

if [ "$OS" = "darwin" ]; then
  shasum -a 256 -c "${TMPDIR}/dvx.zip.sha256" || { echo "Checksum verification failed" >&2; rm -rf "$TMPDIR"; exit 1; }
else
  sha256sum -c "${TMPDIR}/dvx.zip.sha256" || { echo "Checksum verification failed" >&2; rm -rf "$TMPDIR"; exit 1; }
fi

unzip -q "${TMPDIR}/dvx.zip" -d "${TMPDIR}"
install -m 755 "${TMPDIR}/dvx" /usr/local/bin/dvx
[ -f "${TMPDIR}/better_sqlite3.node" ] && install -m 755 "${TMPDIR}/better_sqlite3.node" /usr/local/lib/dvx-better-sqlite3.node
rm -rf "$TMPDIR"
echo "dvx ${VERSION} installed to /usr/local/bin/dvx"
