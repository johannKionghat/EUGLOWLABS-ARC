import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EmbeddedPlaybooksLoader } from "./playbooks-loader.js";

const MOCK_MANIFEST: Readonly<Record<string, string>> = Object.freeze({
  "setup.yml": "---\n# fake setup playbook\n",
  "requirements.yml": "---\nroles: []\n",
  "roles/hardening/tasks/main.yml": "- name: noop\n  debug: msg=hi\n",
  "roles/hardening/handlers/main.yml": "- name: restart\n  debug: msg=ok\n",
  "roles/backups/templates/script.sh.j2": "#!/bin/bash\necho {{ name }}\n",
});

describe("EmbeddedPlaybooksLoader", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "arc-loader-test-"));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("listPlaybooks returns all manifest keys", () => {
    const loader = new EmbeddedPlaybooksLoader(MOCK_MANIFEST);
    expect(loader.listPlaybooks()).toHaveLength(5);
    expect(loader.listPlaybooks()).toContain("setup.yml");
    expect(loader.listPlaybooks()).toContain("roles/hardening/tasks/main.yml");
  });

  it("extractToDisk writes every file with full content", async () => {
    const loader = new EmbeddedPlaybooksLoader(MOCK_MANIFEST);
    const target = join(workDir, "v0.0.0-dev");
    await loader.extractToDisk(target);

    const setup = await readFile(join(target, "setup.yml"), "utf-8");
    expect(setup).toBe(MOCK_MANIFEST["setup.yml"]);

    const role = await readFile(join(target, "roles/hardening/tasks/main.yml"), "utf-8");
    expect(role).toBe(MOCK_MANIFEST["roles/hardening/tasks/main.yml"]);
  });

  it("extractToDisk creates nested directories on demand", async () => {
    const loader = new EmbeddedPlaybooksLoader(MOCK_MANIFEST);
    const target = join(workDir, "v0.0.0-dev");
    await loader.extractToDisk(target);

    const handlersDir = await stat(join(target, "roles/hardening/handlers"));
    expect(handlersDir.isDirectory()).toBe(true);

    const templatesDir = await stat(join(target, "roles/backups/templates"));
    expect(templatesDir.isDirectory()).toBe(true);
  });

  it("extractToDisk is idempotent — overwrites existing files cleanly", async () => {
    const loader = new EmbeddedPlaybooksLoader(MOCK_MANIFEST);
    const target = join(workDir, "v0.0.0-dev");

    await loader.extractToDisk(target);
    await loader.extractToDisk(target);

    const setup = await readFile(join(target, "setup.yml"), "utf-8");
    expect(setup).toBe(MOCK_MANIFEST["setup.yml"]);
    const entries = await readdir(target);
    expect(entries.sort()).toEqual(["requirements.yml", "roles", "setup.yml"]);
  });

  it("extractToDisk on empty manifest creates only the target directory", async () => {
    const loader = new EmbeddedPlaybooksLoader({});
    const target = join(workDir, "empty");
    await loader.extractToDisk(target);

    const targetStat = await stat(target);
    expect(targetStat.isDirectory()).toBe(true);
    const entries = await readdir(target);
    expect(entries).toEqual([]);
  });

  it("listPlaybooks order is stable between calls", () => {
    const loader = new EmbeddedPlaybooksLoader(MOCK_MANIFEST);
    const first = loader.listPlaybooks();
    const second = loader.listPlaybooks();
    expect(first).toEqual(second);
  });
});
