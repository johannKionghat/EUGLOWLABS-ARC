#!/usr/bin/env sh
# EuglowLabs ARC CLI — install script.
# Usage: curl -fsSL https://install-arc.euglowlabs.com | sh
#
# Detects the OS / arch, downloads the matching binary from the
# latest GitHub Release, and drops it in /usr/local/bin/arc (or
# $ARC_INSTALL_DIR if set).
#
# Naming convention (ADR-0016 §3) : install-<produit>.euglowlabs.com
# Each EuglowLabs product (ARC, EuglowLabs Dev, futurs) has its own
# install-* subdomain. The bare install.euglowlabs.com is reserved
# (not allocated to any single product).
set -eu

REPO="${ARC_REPO:-johannKionghat/EUGLOWLABS-ARC}"
VERSION="${ARC_VERSION:-latest}"
INSTALL_DIR="${ARC_INSTALL_DIR:-/usr/local/bin}"

uname_os() {
  case "$(uname -s)" in
    Linux) echo "linux" ;;
    Darwin) echo "darwin" ;;
    *) echo "unsupported"; return 1 ;;
  esac
}

uname_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "unsupported"; return 1 ;;
  esac
}

OS="$(uname_os)"
ARCH="$(uname_arch)"
if [ "$OS" = "unsupported" ] || [ "$ARCH" = "unsupported" ]; then
  echo "Unsupported platform: $(uname -s) $(uname -m)" >&2
  exit 1
fi

ASSET="arc-${OS}-${ARCH}"
if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
else
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
fi

TMP="$(mktemp -t arc.XXXXXX)"
trap 'rm -f "$TMP"' EXIT

echo "Downloading ${URL}"
if command -v curl >/dev/null 2>&1; then
  curl -fsSL "$URL" -o "$TMP"
elif command -v wget >/dev/null 2>&1; then
  wget -q "$URL" -O "$TMP"
else
  echo "Need curl or wget on PATH" >&2
  exit 1
fi

chmod +x "$TMP"
TARGET="${INSTALL_DIR}/arc"
if [ -w "$INSTALL_DIR" ]; then
  mv "$TMP" "$TARGET"
else
  echo "Installing to $TARGET (sudo)"
  sudo mv "$TMP" "$TARGET"
fi

echo "Installed: $("$TARGET" version)"
