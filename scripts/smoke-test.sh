#!/usr/bin/env bash
#
# scripts/smoke-test.sh — EuglowLabs ARC E2E runtime smoke test.
#
# Validates a freshly-installed ARC host (Phase 1.5) by checking ~40 things
# across hardening (UFW/fail2ban/SSH), Docker engine + networks (ADR-0008),
# Coolify + ai-stack endpoints, backups infrastructure, and CLI smoke.
#
# Usage:
#   sudo bash scripts/smoke-test.sh             # full report with ANSI colors
#   sudo bash scripts/smoke-test.sh --no-color  # plain text output (CI-friendly)
#   bash scripts/smoke-test.sh --help           # usage
#
# Exit codes:
#   0 — all checks passed
#   1 — at least one check failed
#   2 — execution error (not running as root, unknown flag, …)
#
# Run after `arc setup --apply` on a fresh Ubuntu 24.04 / Debian 12 VPS.

set -euo pipefail
IFS=$'\n\t'

# --- argv parsing ---
NO_COLOR_FLAG=0
usage() {
  cat <<'EOF'
EuglowLabs ARC — E2E runtime smoke test

Usage:
  sudo bash scripts/smoke-test.sh [OPTIONS]

Options:
  --no-color   Disable ANSI color (also via NO_COLOR env var or non-TTY stdout)
  --help, -h   Show this help

Sections covered:
  1. Bootstrap & runtime context (info: host, OS, arc_user)
  2. Hardening — UFW (active, default deny, allow ssh/80/443, IPv6, no 8000)
  3. Hardening — fail2ban (active, jails sshd + recidive)
  4. Hardening — SSH (drop-in 99-arc.conf, password auth disabled)
  5. Docker engine (running, version, compose v2, arc_user in docker group)
  6. Networks (3 ARC networks ADR-0008, subnets, labels, sandbox_net runtime)
  7. Coolify + ai-stack (HTTP healthchecks)
  8. Backups infrastructure (script, cron, rclone config, remotes)
  9. CLI ARC (binary, --dry-run smoke)

Exit codes: 0 = all passed, 1 = at least one fail, 2 = execution error.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-color) NO_COLOR_FLAG=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) printf "Unknown option: %s\n\n" "$1" >&2; usage >&2; exit 2 ;;
  esac
done

# --- root check ---
if [[ "${EUID}" -ne 0 ]]; then
  printf "Error: smoke-test.sh requires root. Run with: sudo bash scripts/smoke-test.sh\n" >&2
  exit 2
fi

# --- color setup (NO_COLOR.org spec + flag + TTY) ---
if [[ "$NO_COLOR_FLAG" -eq 1 ]] || [[ -n "${NO_COLOR:-}" ]] || [[ ! -t 1 ]]; then
  RED=""; GREEN=""; YELLOW=""; BOLD=""; RESET=""
else
  RED=$'\033[0;31m'
  GREEN=$'\033[0;32m'
  YELLOW=$'\033[0;33m'
  BOLD=$'\033[1m'
  RESET=$'\033[0m'
fi

# --- counters (use $((...)) to avoid set -e + ((var++)) returning 1 from 0) ---
PASSED=0
FAILED=0
WARNED=0

# --- helpers ---
section() { printf "\n${BOLD}===== %s =====${RESET}\n" "$1"; }
pass()    { printf "  ${GREEN}✓${RESET} %s\n" "$1"; PASSED=$((PASSED + 1)); }
fail()    { printf "  ${RED}✗${RESET} %s\n" "$1"; FAILED=$((FAILED + 1)); }
warn()    { printf "  ${YELLOW}⚠${RESET} %s\n" "$1"; WARNED=$((WARNED + 1)); }

# Run a command silently and pass/fail based on exit code.
check_cmd() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$name"; else fail "$name"; fi
}

# Run a command and grep its stdout for an extended-regex pattern.
check_output() {
  local name="$1" pattern="$2"; shift 2
  if "$@" 2>/dev/null | grep -qE -- "$pattern"; then pass "$name"; else fail "$name"; fi
}

# Check a file exists with optional expected mode (octal, no leading zero — stat
# -c '%a' returns "750" not "0750", so callers should pass "750").
check_file() {
  local name="$1" path="$2" expected_mode="${3:-}"
  if [[ ! -e "$path" ]]; then
    fail "$name (missing: $path)"; return
  fi
  if [[ -n "$expected_mode" ]]; then
    local actual_mode
    actual_mode="$(stat -c '%a' "$path" 2>/dev/null || echo '?')"
    if [[ "$actual_mode" != "$expected_mode" ]]; then
      fail "$name (mode $actual_mode, expected $expected_mode)"; return
    fi
  fi
  pass "$name"
}

# Check an HTTP endpoint returns one of the expected status codes (default 200,302,401).
check_http() {
  local name="$1" url="$2" expected_codes="${3:-200,302,401}"
  if ! command -v curl >/dev/null 2>&1; then
    warn "$name (curl not installed, skipped)"; return
  fi
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo '000')"
  if [[ ",${expected_codes}," == *",${code},"* ]]; then
    pass "$name (HTTP $code)"
  else
    fail "$name (HTTP $code, expected one of $expected_codes)"
  fi
}

# --- arc_user detection ---
detect_arc_user() {
  if [[ -n "${SUDO_USER:-}" ]] && [[ "${SUDO_USER}" != "root" ]]; then
    echo "$SUDO_USER"
  elif [[ -n "${USER:-}" ]] && [[ "$USER" != "root" ]]; then
    echo "$USER"
  else
    return 1
  fi
}

ARC_USER="$(detect_arc_user)" || {
  printf "Error: cannot detect arc_user (SUDO_USER and USER both empty or root).\n" >&2
  printf "Run as: sudo bash scripts/smoke-test.sh\n" >&2
  exit 2
}
ARC_HOME="$(getent passwd "$ARC_USER" | cut -d: -f6)"
ARC_SSH_PORT="${ARC_SSH_PORT:-22}"

# --- summary trap (always prints, even on early set -e exit) ---
on_exit() {
  printf "\n${BOLD}Summary:${RESET} ${GREEN}%d passed${RESET}, ${RED}%d failed${RESET}, ${YELLOW}%d warned${RESET}\n" \
    "$PASSED" "$FAILED" "$WARNED"
}
trap on_exit EXIT

# ===================================================================
# 1. Bootstrap & runtime context (info-only)
# ===================================================================
section "Bootstrap & runtime context"
printf "  Hostname    : %s\n" "$(hostname)"
printf "  Kernel      : %s\n" "$(uname -r)"
printf "  Distribution: %s\n" "$(. /etc/os-release && echo "$PRETTY_NAME")"
printf "  arc_user    : %s (home: %s)\n" "$ARC_USER" "$ARC_HOME"
printf "  Timestamp   : %s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# ===================================================================
# 2. Hardening — UFW
# ===================================================================
section "Hardening — UFW"
check_output "UFW status active"             "Status: active"             ufw status verbose
check_output "default deny incoming"         "Default: deny \(incoming\)" ufw status verbose
check_output "default allow outgoing"        "allow \(outgoing\)"         ufw status verbose
check_output "allow port ${ARC_SSH_PORT}/tcp (SSH)" "${ARC_SSH_PORT}/tcp" ufw status verbose
check_output "allow port 80/tcp"             "80/tcp"                     ufw status verbose
check_output "allow port 443/tcp"            "443/tcp"                    ufw status verbose
check_output "IPv6 enabled"                  "^IPV6=yes"                  cat /etc/default/ufw

# Negative check: port 8000 must NOT be exposed (Q6 — Coolify localhost-only)
if ufw status verbose | grep -qE '^8000/tcp\s+ALLOW'; then
  fail "port 8000/tcp is exposed (Coolify dashboard should remain localhost-only, Q6)"
else
  pass "port 8000/tcp not exposed (Q6 — Coolify localhost-only)"
fi

# ===================================================================
# 3. Hardening — fail2ban
# ===================================================================
section "Hardening — fail2ban"
check_cmd    "fail2ban service active" systemctl is-active --quiet fail2ban
check_output "jail sshd enabled"     "Jail list:.*sshd"     fail2ban-client status
check_output "jail recidive enabled" "Jail list:.*recidive" fail2ban-client status

# ===================================================================
# 4. Hardening — SSH
# ===================================================================
section "Hardening — SSH"
check_cmd    "sshd config valid (sshd -t)"        sshd -t
check_file   "drop-in 99-arc.conf present (0644)" /etc/ssh/sshd_config.d/99-arc.conf 644
check_output "PasswordAuthentication disabled"    "^PasswordAuthentication no"                cat /etc/ssh/sshd_config.d/99-arc.conf
check_output "PubkeyAuthentication enabled"       "^PubkeyAuthentication yes"                 cat /etc/ssh/sshd_config.d/99-arc.conf
check_output "PermitRootLogin restricted"         "^PermitRootLogin (prohibit-password|no)"   cat /etc/ssh/sshd_config.d/99-arc.conf

# ===================================================================
# 5. Docker engine
# ===================================================================
section "Docker engine"
check_cmd    "docker service active"      systemctl is-active --quiet docker
check_cmd    "docker version reachable"   docker version
check_output "docker compose v2 plugin"   "Docker Compose version v?2\."  docker compose version
check_output "${ARC_USER} in docker group" "(^| )docker( |$)"             id -Gn "$ARC_USER"

# ===================================================================
# 6. Networks (ADR-0008)
# ===================================================================
section "Networks (ADR-0008)"
for net in prod_net ai_net sandbox_net; do
  check_cmd "network ${net} present" docker network inspect "$net"
done
check_output "prod_net subnet 172.20.0.0/24"      '"Subnet": "172.20.0.0/24"' docker network inspect prod_net
check_output "ai_net subnet 172.21.0.0/24"        '"Subnet": "172.21.0.0/24"' docker network inspect ai_net
check_output "sandbox_net subnet 172.22.0.0/24"   '"Subnet": "172.22.0.0/24"' docker network inspect sandbox_net
check_output "sandbox_net Internal: true (config)" '"Internal": true'         docker network inspect sandbox_net
check_output "prod_net label arc.managed-by=ansible" '"arc.managed-by": "ansible"' docker network inspect prod_net

# Runtime isolation: ping must FAIL (inversion logic)
sandbox_isolated() {
  ! timeout 15 docker run --rm --network sandbox_net alpine:latest \
    ping -c 1 -W 3 8.8.8.8 >/dev/null 2>&1
}
check_cmd "sandbox_net cannot reach internet (runtime isolation)" sandbox_isolated

# ===================================================================
# 7. Coolify + ai-stack endpoints
# ===================================================================
section "Coolify + ai-stack endpoints"
check_http "Coolify (localhost:8000)"               "http://localhost:8000"               "200,302,401"
check_http "Supabase Kong (localhost:8001)"         "http://localhost:8001"               "200,302,401,404"
check_http "Ollama API (localhost:11434/api/version)" "http://localhost:11434/api/version" "200"

# ===================================================================
# 8. Backups infrastructure
# ===================================================================
section "Backups infrastructure"
check_file   "backup script /usr/local/bin/arc-backup.sh (0750)" /usr/local/bin/arc-backup.sh 750
check_file   "cron entry /etc/cron.d/arc-backup (0644)"          /etc/cron.d/arc-backup       644
check_file   "rclone.conf /root/.config/rclone/rclone.conf (0600)" /root/.config/rclone/rclone.conf 600

# r2.env is operator-managed → warn if absent rather than fail
if [[ -e "${ARC_HOME}/.arc/credentials/r2.env" ]]; then
  pass "r2.env present at ${ARC_HOME}/.arc/credentials/r2.env"
else
  warn "r2.env missing at ${ARC_HOME}/.arc/credentials/r2.env (backups will be skipped at runtime)"
fi
check_output "rclone remote arc-r2 configured"       "^arc-r2:$"       rclone listremotes
check_output "rclone remote arc-r2-crypt configured" "^arc-r2-crypt:$" rclone listremotes

# ===================================================================
# 9. CLI ARC (offline smoke)
# ===================================================================
section "CLI ARC (offline smoke)"
if ! command -v arc >/dev/null 2>&1; then
  warn "arc binary not in PATH (skipping CLI checks)"
else
  check_cmd "arc --help exits 0" arc --help
  check_cmd "arc dns add --dry-run (no token needed)" \
    arc dns add foo.example.test --type A --content 1.2.3.4 --dry-run
  check_cmd "arc dns remove --dry-run" \
    arc dns remove foo.example.test --type A --dry-run
fi

# ===================================================================
# Final exit (trap prints summary)
# ===================================================================
if [[ "$FAILED" -gt 0 ]]; then
  exit 1
fi
exit 0
