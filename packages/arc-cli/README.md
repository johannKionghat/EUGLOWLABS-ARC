# @euglowlabs/arc-cli

The `arc` CLI for **EuglowLabs ARC**. See the [root README](../../README.md) for product overview, quickstart, and roadmap.

## Development setup

### Ansible collections

Required collections are pinned in `playbooks/requirements.yml`:

```bash
ansible-galaxy collection install -r packages/arc-cli/playbooks/requirements.yml
```

Run this once before `arc setup --apply` if you're using a minimal Ansible install (`ansible-core`). Skip if you have the full `ansible` package which bundles `community.*` collections.
