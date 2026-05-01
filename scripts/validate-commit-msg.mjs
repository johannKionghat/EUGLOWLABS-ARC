#!/usr/bin/env node
// Validate the commit-msg first line against EuglowLabs ARC convention.
// Format expected: <type>(<scope>): <description> [<TASK-ID>]
// Optional trailing GitHub squash suffix " (#NN)".
// See docs/04-conventions/naming.md.

import { readFileSync } from "node:fs";
import { argv, exit, stderr, stdout } from "node:process";

const TYPES = ["feat", "fix", "refactor", "chore", "docs", "test", "spike"];
const COMMIT_REGEX = new RegExp(
  `^(${TYPES.join("|")})(\\([a-z0-9-]+\\))?: .+ \\[[A-Z]+-\\d+\\]( \\(#\\d+\\))?$`,
);
const BYPASS_PREFIXES = ["Merge ", "Revert ", "fixup!", "squash!", "amend!"];

const path = argv[2];
if (!path) {
  stderr.write("validate-commit-msg: missing commit message file path\n");
  exit(1);
}

const raw = readFileSync(path, "utf8");
const firstLine = raw.split("\n").find((line) => line.trim().length > 0) ?? "";

if (BYPASS_PREFIXES.some((prefix) => firstLine.startsWith(prefix))) {
  exit(0);
}

if (COMMIT_REGEX.test(firstLine)) {
  exit(0);
}

stderr.write(
  [
    "",
    "✗ Commit message rejected.",
    "",
    `  Got:      ${firstLine || "(empty)"}`,
    "  Expected: <type>(<scope>): <description> [<TASK-ID>]",
    "",
    `  Allowed types : ${TYPES.join(", ")}`,
    "  Scope         : optional, lowercase kebab-case (e.g. cli, agent, dashboard)",
    "  TASK-ID       : required, format SCOPE-NNN (e.g. CLI-042, INFRA-007)",
    "",
    "  Examples:",
    "    feat(cli): add deploy command [CLI-042]",
    "    fix(agent): handle websocket reconnect [AGENT-013]",
    "    chore(repo): bump turbo to 2.x [INFRA-005]",
    "",
    "  Reference: docs/04-conventions/naming.md",
    "",
  ].join("\n"),
);
stdout.write("");
exit(1);
