# Release Process — EuglowLabs ARC

> Maintainer SOP for cutting a release. For end-user install instructions,
> see [`installation.md`](installation.md). For the strategy ADR, see
> [`ADR-0016`](03-architecture-decisions/0016-distribution-strategy.md).

## Prerequisites (one-time setup)

- **GitHub Personal Access Token** with `workflow` scope (classic PAT or
  fine-grained with Actions write). Required to push commits that touch
  `.github/workflows/*`.
- **Cloudflare Pages access** to the `euglowlabs-arc` project (DIST-001 1d-2).
- **Cloudflare DNS access** to the `euglowlabs.com` zone (for the
  `install-arc` CNAME). DIST-001 1d-2.
- A disposable VPS (Hetzner CX22, Scaleway DEV1-S, etc.) for the smoke
  test in step 6.

## Step-by-step

### 1. Stage the version bump

```sh
pnpm changeset                  # interactive — pick patch / minor / major
pnpm changeset version          # writes CHANGELOG.md + bumps package.json
```

The version in `packages/arc-cli/package.json` is what
`build-binaries.mjs` injects into `__ARC_VERSION__` at compile time
(DIST-001 1a-3). It MUST be a strict SemVer (no `v` prefix in
package.json).

### 2. Open and merge the version PR

Standard PR flow. CI must be green (`ci.yml`, `release.yml --dry-run`).

### 3. Tag the release

```sh
git checkout main && git pull
git tag v0.X.Y                  # MUST match packages/arc-cli/package.json
git push origin v0.X.Y
```

The tag triggers `.github/workflows/publish.yml` (DIST-001 1c).

### 4. Watch the CI release pipeline

Open the run from the [GitHub Actions tab](https://github.com/johannKionghat/EUGLOWLABS-ARC/actions/workflows/publish.yml).

The pipeline runs (~10 min) :

1. Pre-flight (`pnpm lint`, `typecheck`, `test`, `build`)
2. Cross-compile 5 targets via `bun --target` (`build-binaries.mjs`)
3. Generate SHA256 for linux x64 + arm64
4. Upload 4 artefacts via `softprops/action-gh-release@v2` :
   - `arc-linux-x64`
   - `arc-linux-arm64`
   - `arc-linux-x64.sha256`
   - `arc-linux-arm64.sha256`

`fail_on_unmatched_files: true` makes the workflow refuse to publish
the release if any artefact is missing.

For `vX.Y.Z-rc.N` / `-beta.N` / `-alpha.N` tags, the release is
automatically flagged as prerelease (the "Latest" pointer doesn't move).

### 5. Cloudflare Pages auto-deploy

Cloudflare Pages is configured to redeploy on every `main` push
(DIST-001 1d-2). Verify :

```sh
curl -I https://install-arc.euglowlabs.com
# HTTP/2 200
# content-type: text/plain; charset=utf-8
```

### 6. Smoke test on a fresh VPS

Provision a disposable Ubuntu 24.04 VPS, ssh in, then :

```sh
curl -fsSL https://install-arc.euglowlabs.com | sh
arc version                     # arc v0.X.Y (sha=<short>, built=<ISO>)
arc setup --apply
sudo bash <(curl -fsSL https://raw.githubusercontent.com/johannKionghat/EUGLOWLABS-ARC/main/scripts/smoke-test.sh)
```

Full procedure : [`E2E-test-procedure.md`](E2E-test-procedure.md).

### 7. Announce

Phase 2 placeholder — Discord, blog, changelog blast. For Phase 1 just
update [`tasks/INDEX.md`](../tasks/INDEX.md) Phase column.

## Pre-releases

Use a SemVer suffix : `v0.2.0-rc.1`, `v0.2.0-beta.2`, `v0.2.0-alpha.3`.

The `publish.yml` workflow auto-detects these and flags the release as
prerelease — the GitHub "Latest" pointer stays on the previous stable
release, so end users running `curl -fsSL https://install-arc.euglowlabs.com | sh`
without `ARC_VERSION` pin keep getting the latest stable, not the
prerelease.

## Backout

If a release ships a critical bug :

```sh
# 1. Mark the release as drafted (hidden, doesn't move "Latest")
gh release edit v0.X.Y --draft

# 2. Delete the tag locally and remotely
git tag -d v0.X.Y
git push origin :refs/tags/v0.X.Y

# 3. Revert the version bump PR
gh pr revert <pr-number> --merge
```

The "Latest" GitHub Release pointer will roll back to the previous
non-draft release. Users running the install one-liner will get that
version. **Existing installations are NOT auto-rolled back** —
communicate the rollback explicitly.

## Operational notes

- **PAT scope `workflow`** is mandatory to push commits touching
  `.github/workflows/*` (encountered in DIST-001 1c push).
- **Cache TTL on `install-arc.euglowlabs.com`** is 5 min (DIST-001 1d-1
  `_headers` `max-age=300`). Urgent install.sh fixes take effect quickly.
- **Cosign / Sigstore signing** is deferred to backlog `DIST-002`.
  Today : SHA256 only.
- **macOS / Windows builds** are deferred to backlog `DIST-004`.
- **`arc self-update`** is deferred to backlog `DIST-003`. Today :
  re-run the install one-liner.
