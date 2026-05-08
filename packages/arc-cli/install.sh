#!/bin/sh
# EuglowLabs ARC CLI — installer.
# Usage:
#   curl -fsSL https://install-arc.euglowlabs.com | sh
#
# Optional env overrides (set BEFORE the curl|sh pipe):
#   ARC_VERSION       Pin a specific release (default: latest from GitHub).
#                     Accepts "0.1.0" or "v0.1.0".
#   ARC_REPO          GitHub repo (default: johannKionghat/EUGLOWLABS-ARC).
#   ARC_INSTALL_DIR   Install directory (default: /usr/local/bin).
#
# Examples:
#   curl -fsSL https://install-arc.euglowlabs.com | sh
#   curl -fsSL https://install-arc.euglowlabs.com | ARC_VERSION=0.1.0 sh
#   curl -fsSL https://install-arc.euglowlabs.com | ARC_INSTALL_DIR=$HOME/.local/bin sh
#
# Naming convention (ADR-0016 §3): install-<produit>.euglowlabs.com.
# Each EuglowLabs product (ARC, EuglowLabs Dev, futurs) has its own
# install-* subdomain. The bare install.euglowlabs.com is reserved.
#
# Pattern (ADR-0016 §3): the script runs WITHOUT sudo at the top level.
# It elevates with sudo only for privileged operations (writing to
# /usr/local/bin/). Consistent with Docker, Tailscale, Bun, Deno.
#
# This script is strict POSIX sh. It does NOT rely on bash features
# because /bin/sh on Ubuntu 24.04 (the primary install target) is
# dash, which ignores the shebang when invoked via `curl ... | sh`.

set -eu

REPO="${ARC_REPO:-johannKionghat/EUGLOWLABS-ARC}"
VERSION="${ARC_VERSION:-}"
INSTALL_DIR="${ARC_INSTALL_DIR:-/usr/local/bin}"

# ---------------------------------------------------------------------------
# OS / arch detection — Linux x64/arm64 only for MVP (DIST-001 §D-DIST-4).
# darwin/windows releases are deferred to backlog DIST-004.
# ---------------------------------------------------------------------------

detect_os() {
  case "$(uname -s)" in
    Linux*) echo "linux" ;;
    Darwin*)
      echo "ERROR: macOS is not supported in MVP. See backlog DIST-004." >&2
      exit 1
      ;;
    *)
      echo "ERROR: unsupported OS: $(uname -s). Linux only (x64 or arm64)." >&2
      exit 1
      ;;
  esac
}

detect_arch() {
  case "$(uname -m)" in
    x86_64|amd64) echo "x64" ;;
    aarch64|arm64) echo "arm64" ;;
    *)
      echo "ERROR: unsupported arch: $(uname -m). x64 or arm64 only." >&2
      exit 1
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Download helpers — curl preferred, wget fallback (Docker minimal
# compatibility).
# ---------------------------------------------------------------------------

require_downloader() {
  if command -v curl >/dev/null 2>&1; then
    return 0
  elif command -v wget >/dev/null 2>&1; then
    return 0
  fi
  echo "ERROR: need curl or wget on PATH." >&2
  exit 1
}

download_to_file() {
  url="$1"
  out="$2"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url" -o "$out"
  else
    wget -qO "$out" "$url"
  fi
}

download_to_stdout() {
  url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$url"
  else
    wget -qO- "$url"
  fi
}

# ---------------------------------------------------------------------------
# GitHub Releases — resolve "latest" tag via API if VERSION is unset.
# Robust parsing: cut field 4 of the "tag_name" JSON line. Avoids fragile
# regex on the full payload.
# ---------------------------------------------------------------------------

fetch_latest_tag() {
  api_url="https://api.github.com/repos/${REPO}/releases/latest"
  download_to_stdout "$api_url" \
    | grep '"tag_name":' \
    | head -n1 \
    | cut -d'"' -f4
}

# ---------------------------------------------------------------------------
# SHA256 helpers — sha256sum (Linux GNU coreutils) preferred, shasum
# fallback (BSD / Mac compatibility, useful when running this script
# under WSL or Lima with a BSD coreutils).
# ---------------------------------------------------------------------------

sha256_of_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo "ERROR: need sha256sum or shasum to verify integrity." >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Main flow
# ---------------------------------------------------------------------------

require_downloader
OS="$(detect_os)"
ARCH="$(detect_arch)"

# Resolve version.
if [ -z "$VERSION" ]; then
  echo "→ Resolving latest release tag from github.com/${REPO}..."
  VERSION="$(fetch_latest_tag)"
  if [ -z "$VERSION" ]; then
    echo "ERROR: failed to resolve latest version." >&2
    echo "       Pin a version with ARC_VERSION=X.Y.Z, or check your network." >&2
    exit 1
  fi
fi

# Normalise the tag — accept "0.1.0" and "v0.1.0", URL needs leading "v".
case "$VERSION" in
  v*) TAG="$VERSION" ;;
  *)  TAG="v$VERSION" ;;
esac

ASSET="arc-${OS}-${ARCH}"
BIN_URL="https://github.com/${REPO}/releases/download/${TAG}/${ASSET}"
SHA_URL="${BIN_URL}.sha256"

echo "→ Installing arc ${TAG} (${OS}/${ARCH})..."

# Sudo detection — root-direct, sudo, or fail.
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo "ERROR: writing to ${INSTALL_DIR} requires root, and sudo is unavailable." >&2
    echo "       Run as root, install sudo, or set ARC_INSTALL_DIR to a directory you own:" >&2
    echo "         curl ... | ARC_INSTALL_DIR=\$HOME/.local/bin sh" >&2
    exit 1
  fi
fi

# Idempotent overwrite — surface the previous version if present.
TARGET="${INSTALL_DIR}/arc"
if [ -x "$TARGET" ]; then
  prev="$("$TARGET" --version 2>/dev/null || echo unknown)"
  echo "→ Replacing existing arc ${prev} with arc ${TAG}..."
fi

# Atomic install : download to temp, verify, then mv.
TMP="$(mktemp -t arc.XXXXXX)" || {
  echo "ERROR: failed to create temp file (is /tmp full or read-only?)." >&2
  exit 1
}
trap 'rm -f "$TMP" "${TMP}.sha256"' EXIT

echo "→ Downloading ${BIN_URL}..."
download_to_file "$BIN_URL" "$TMP"

echo "→ Downloading ${SHA_URL}..."
download_to_file "$SHA_URL" "${TMP}.sha256"

# .sha256 file format: "<hex>  <filename>" (sha256sum output) — awk extracts
# field 1 regardless of single- or double-space separator.
expected_sha="$(awk '{print $1}' "${TMP}.sha256")"
actual_sha="$(sha256_of_file "$TMP")"
if [ "$expected_sha" != "$actual_sha" ]; then
  echo "ERROR: SHA256 mismatch — refusing to install." >&2
  echo "       expected: ${expected_sha}" >&2
  echo "       actual:   ${actual_sha}" >&2
  echo "       url:      ${BIN_URL}" >&2
  exit 1
fi
echo "✓ SHA256 verified (${actual_sha})"

chmod +x "$TMP"
$SUDO mkdir -p "$INSTALL_DIR"
$SUDO mv "$TMP" "$TARGET"

# Sanity-check the installed binary actually runs.
if ! "$TARGET" --version >/dev/null 2>&1; then
  echo "ERROR: installed binary failed to run. Check ${TARGET}." >&2
  exit 1
fi

# UX next-steps.
cat <<EOF

✓ arc ${TAG} installed at ${TARGET}.

Next steps:
  1. Initialize a config:           arc init
  2. Configure DNS / R2 credentials: see ~/.arc/credentials/ (docs/installation.md)
  3. Apply the stack:               arc setup --apply

Repo:  https://github.com/${REPO}
Docs:  https://github.com/${REPO}/blob/main/docs/installation.md

EOF
