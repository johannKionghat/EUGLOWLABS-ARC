# Installation — EuglowLabs ARC

> User-facing install guide. For maintainer release flow, see
> [`release-process.md`](release-process.md). For end-to-end smoke
> procedure on a fresh VPS, see [`E2E-test-procedure.md`](E2E-test-procedure.md).

## Prerequisites

- Linux **x64** or **arm64** (Ubuntu 24.04 LTS or Debian 12 recommended)
- `sudo` available (the installer elevates only to write `/usr/local/bin/`)
- `curl` **or** `wget` on `PATH`
- `sha256sum` **or** `shasum` (any standard Linux distro has one)
- Outbound HTTPS to `install-arc.euglowlabs.com`, `api.github.com`, `github.com`

**Not supported in this MVP** : macOS, Windows. Tracked in backlog `DIST-004`.
WSL2 detection ships in backlog `LOCAL-001` (`arc setup --mode local`).

## One-line install

```sh
curl -fsSL https://install-arc.euglowlabs.com | sh
```

What it does :

1. Detects OS/arch (`linux/x64` or `linux/arm64`)
2. Resolves the latest release tag from GitHub
3. Downloads `arc-<os>-<arch>` and `arc-<os>-<arch>.sha256` from GitHub Releases
4. Verifies SHA256 (mandatory — refuses to install on mismatch)
5. Moves the binary to `/usr/local/bin/arc` (via `sudo` if you're not root)
6. Runs `arc --version` to sanity-check

Expected output ends with :

```text
✓ arc v0.1.0 installed at /usr/local/bin/arc.

Next steps:
  1. Initialize a config:           arc init
  2. Configure DNS / R2 credentials: see ~/.arc/credentials/ (docs/installation.md)
  3. Apply the stack:               arc setup --apply
```

## Verify

```sh
arc version
# arc 0.1.0 (sha=<short>, built=<ISO date>)
```

The `sha=` and `built=` markers are injected at compile time via
`bun --define` (DIST-001 1a-3). If you see `sha=unknown` or
`built=dev`, you're running a development build, not a release.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ARC_VERSION` | latest release | Pin a specific version (accepts `0.1.0` or `v0.1.0`) |
| `ARC_REPO` | `johannKionghat/EUGLOWLABS-ARC` | Override the GitHub repo (mirror / fork) |
| `ARC_INSTALL_DIR` | `/usr/local/bin` | Install target directory |

Examples :

```sh
# Pin a specific version
curl -fsSL https://install-arc.euglowlabs.com | ARC_VERSION=0.1.0 sh

# Install to your home directory (no sudo needed)
curl -fsSL https://install-arc.euglowlabs.com | ARC_INSTALL_DIR=$HOME/.local/bin sh
```

## Configure (after install)

`arc` needs credentials before `arc setup --apply` can run :

```sh
arc init                       # interactive config → ~/.arc/arc.config.yml
mkdir -p ~/.arc/credentials
chmod 700 ~/.arc/credentials
# Then create ~/.arc/credentials/cloudflare.env and ~/.arc/credentials/r2.env
```

Format of the credential files is documented in
[`E2E-test-procedure.md` §2](E2E-test-procedure.md#2-configuration-des-credentials-10-min).

## Apply the stack

```sh
arc setup --apply
```

This runs the embedded Ansible playbooks against `localhost` (ADR-0012).
First run takes ~30 minutes on a fresh Ubuntu 24.04 VPS (Docker install,
Coolify, local-ai-packaged, sandbox network).

## Troubleshooting

### `SHA256 mismatch — refusing to install.`

The downloaded binary didn't match its checksum. Two causes :

- Network corruption during download → re-run the installer
- The release was tampered with → **don't bypass** the check ; open an
  issue at `https://github.com/johannKionghat/EUGLOWLABS-ARC/issues`

### `ERROR: writing to /usr/local/bin requires root`

You're not root and `sudo` isn't installed. Either :

```sh
# Become root
su -
curl -fsSL https://install-arc.euglowlabs.com | sh
```

or install to a directory you own :

```sh
curl -fsSL https://install-arc.euglowlabs.com | ARC_INSTALL_DIR=$HOME/.local/bin sh
# Then ensure $HOME/.local/bin is on PATH:
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

### Port 80 or 443 already in use

`arc setup --apply` installs Caddy (Coolify proxy) which binds 80/443.
Stop any pre-existing nginx/apache/caddy before running setup :

```sh
sudo systemctl stop nginx apache2 caddy 2>/dev/null || true
sudo systemctl disable nginx apache2 caddy 2>/dev/null || true
```

## Upgrade

Re-run the install one-liner. The installer is idempotent and reports
the previous version :

```sh
curl -fsSL https://install-arc.euglowlabs.com | sh
# → Replacing existing arc v0.1.0 with arc v0.2.0...
```

`arc upgrade` (the CLI command) currently prints the same instruction —
real `arc self-update` is tracked in backlog `DIST-003`.

## Next steps

- **First-time users** : full smoke procedure in [`E2E-test-procedure.md`](E2E-test-procedure.md)
- **Maintainers** : release SOP in [`release-process.md`](release-process.md)
- **Architecture rationale** : [`ADR-0016`](03-architecture-decisions/0016-distribution-strategy.md)
