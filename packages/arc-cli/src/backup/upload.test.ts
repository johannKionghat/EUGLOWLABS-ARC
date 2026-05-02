import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { uploadToR2 } from "./upload.js";

describe("uploadToR2", () => {
  it("calls rclone copy with the configured remote, bucket and prefix", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("rclone copy /backups r2:mondomaine-backups/2026 --progress", {
      exitCode: 0,
    });
    const result = await uploadToR2(adapter, {
      source: "/backups",
      remote: "r2",
      bucket: "mondomaine-backups",
      prefix: "2026",
    });
    expect(result.exitCode).toBe(0);
    expect(
      adapter.calls.some(
        (c) =>
          c.method === "exec" &&
          c.cmd === "rclone copy /backups r2:mondomaine-backups/2026 --progress",
      ),
    ).toBe(true);
  });

  it("works without a prefix", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("rclone copy /b r2:bucket --progress", { exitCode: 0 });
    const result = await uploadToR2(adapter, {
      source: "/b",
      remote: "r2",
      bucket: "bucket",
    });
    expect(result.exitCode).toBe(0);
  });

  it("propagates non-zero exit codes", async () => {
    const adapter = new MockAdapter();
    adapter.programExec("rclone copy /b r2:bucket --progress", {
      exitCode: 4,
      stderr: "auth\n",
    });
    const result = await uploadToR2(adapter, {
      source: "/b",
      remote: "r2",
      bucket: "bucket",
    });
    expect(result.exitCode).toBe(4);
  });
});
