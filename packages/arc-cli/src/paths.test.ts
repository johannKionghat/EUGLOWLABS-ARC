import { homedir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { arcConfigPath, arcUserDir } from "./paths.js";

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
});
