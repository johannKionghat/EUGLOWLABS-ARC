# @euglowlabs/arc-cli

The `arc` CLI for **EuglowLabs ARC**. See the [root README](../../README.md) for product overview, quickstart, and roadmap.

## Development setup

### Ansible collections

Required collections are pinned in `playbooks/requirements.yml`:

```bash
ansible-galaxy collection install -r packages/arc-cli/playbooks/requirements.yml
```

Run this once before `arc setup --apply` if you're using a minimal Ansible install (`ansible-core`). Skip if you have the full `ansible` package which bundles `community.*` collections.

## DNS commands

`arc dns` manages DNS records on Cloudflare for the ARC domain (A, CNAME, TXT). All write commands support `--dry-run` for offline auditing and CI checks.

### Configuration

Create `~/.arc/credentials/cloudflare.env` (mode `0600`, owned by your user) with at least:

```env
CLOUDFLARE_API_TOKEN=<your-token-with-Zone:DNS:Edit-scope>
CLOUDFLARE_ZONE_ID=<optional — fallback to auto-discovery if absent>
CLOUDFLARE_API_BASE_URL=<optional — overrides default endpoint>
```

The token needs the `Zone:DNS:Edit` permission on the target zone. Generate one at: https://dash.cloudflare.com/profile/api-tokens.

### List records

```bash
# All records in the configured zone
arc dns list

# Filter by type
arc dns list --type=A

# JSON output (machine-readable)
arc dns list --json
```

### Add record

```bash
# Basic A record (default TTL = 1 = automatic, default comment = "managed-by:arc")
arc dns add foo.example.com --type=A --content=1.2.3.4

# With explicit TTL (1 or 60..86400)
arc dns add www.example.com --type=CNAME --content=example.com --ttl=300

# Replace an existing record (delete-then-create)
arc dns add foo.example.com --type=A --content=5.6.7.8 --force

# Dry-run (no API call, no credentials needed — useful for CI / preview)
arc dns add foo.example.com --type=A --content=1.2.3.4 --dry-run
```

### Remove record

```bash
# By name + type (errors if multiple records match — see --content)
arc dns remove foo.example.com --type=A

# Disambiguate by content when multiple records share name+type
arc dns remove foo.example.com --type=A --content=1.2.3.4

# Dry-run
arc dns remove foo.example.com --type=A --dry-run
```

### Notes

- **`--dry-run`** (on `add` and `remove`) skips credentials loading **and** API calls entirely. Useful in CI when no token is configured.
- **Default comment** on `add` is `"managed-by:arc"`. Pass `--comment=""` to omit, or `--comment="your text"` to override.
- **Zone resolution priority** (highest first):
  1. `--zone <ID>` flag
  2. `CLOUDFLARE_ZONE_ID` in the env file
  3. Heuristic: last 2 labels of the FQDN, with strict name match (defensive against API fuzzy results). For composite TLDs (`.co.uk`, `.com.br`, …), set `CLOUDFLARE_ZONE_ID` explicitly or use `--zone`.
- **Collision on `add`**: if a record already exists for the same `name+type`, the command refuses with a multi-line error suggesting `--force` (replace), `arc dns remove` (clean up first), or `arc dns list` (inspect).
- **`--force` on `add`** does delete-then-create (atomic ARC-side, no PATCH). Handles the rare case where Cloudflare returns multiple records for the same `name+type`.

