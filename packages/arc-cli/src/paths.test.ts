import { homedir } from "node:os";
import { join, sep } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  arcComposeDir,
  arcConfigPath,
  arcCredentialsDir,
  arcPlaybookEntry,
  arcPlaybooksDir,
  arcStatePath,
  arcUserDir,
} from "./paths.js";

describe("paths", () => {
  let originalHome: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
  });

  afterEach(() => {
    if (originalHome === undefined) {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to "undefined" string in process.env, only delete unsets the variable.
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
  });

  describe("arcUserDir", () => {
    it("returns <HOME>/.arc when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcUserDir()).toBe(join("/home/johann", ".arc"));
    });

    it("falls back to os.homedir() when HOME is unset", () => {
      // biome-ignore lint/performance/noDelete: assigning undefined coerces to "undefined" string in process.env, only delete unsets the variable.
      delete process.env.HOME;
      expect(arcUserDir()).toBe(join(homedir(), ".arc"));
    });

    it("is idempotent across calls", () => {
      process.env.HOME = "/tmp/test-home";
      expect(arcUserDir()).toBe(arcUserDir());
    });
  });

  describe("arcConfigPath", () => {
    it("returns <HOME>/.arc/arc.config.yml when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcConfigPath()).toBe(join("/home/johann", ".arc", "arc.config.yml"));
    });

    it("is consistent with arcUserDir", () => {
      process.env.HOME = "/tmp/another-home";
      expect(arcConfigPath().startsWith(arcUserDir())).toBe(true);
    });
  });

  describe("arcComposeDir", () => {
    it("returns <HOME>/.arc/compose when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcComposeDir()).toBe(join("/home/johann", ".arc", "compose"));
    });

    it("sits under arcUserDir", () => {
      process.env.HOME = "/tmp/h";
      expect(arcComposeDir().startsWith(arcUserDir() + sep)).toBe(true);
    });
  });

  describe("arcCredentialsDir", () => {
    it("returns <HOME>/.arc/credentials when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcCredentialsDir()).toBe(join("/home/johann", ".arc", "credentials"));
    });

    it("sits under arcUserDir", () => {
      process.env.HOME = "/tmp/h";
      expect(arcCredentialsDir().startsWith(arcUserDir() + sep)).toBe(true);
    });
  });

  describe("arcStatePath", () => {
    it("returns <HOME>/.arc/state.json when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcStatePath()).toBe(join("/home/johann", ".arc", "state.json"));
    });

    it("sits under arcUserDir", () => {
      process.env.HOME = "/tmp/h";
      expect(arcStatePath().startsWith(arcUserDir() + sep)).toBe(true);
    });
  });

  describe("arcPlaybooksDir", () => {
    it("returns <HOME>/.arc/playbooks/<version> when HOME is set", () => {
      process.env.HOME = "/home/johann";
      expect(arcPlaybooksDir("0.1.0")).toBe(join("/home/johann", ".arc", "playbooks", "0.1.0"));
    });

    it("sits under arcUserDir", () => {
      process.env.HOME = "/tmp/h";
      expect(arcPlaybooksDir("0.0.0-dev").startsWith(arcUserDir() + sep)).toBe(true);
    });
  });

  describe("arcPlaybookEntry", () => {
    it("returns <HOME>/.arc/playbooks/<version>/setup.yml", () => {
      process.env.HOME = "/home/johann";
      expect(arcPlaybookEntry("0.1.0")).toBe(
        join("/home/johann", ".arc", "playbooks", "0.1.0", "setup.yml"),
      );
    });

    it("is consistent with arcPlaybooksDir", () => {
      process.env.HOME = "/tmp/h";
      expect(arcPlaybookEntry("v1").startsWith(arcPlaybooksDir("v1"))).toBe(true);
    });
  });
});
