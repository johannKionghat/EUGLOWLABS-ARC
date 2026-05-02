import { describe, expect, it } from "vitest";

import { MockAdapter } from "../exec/index.js";
import { addProject } from "./add.js";
import { CoolifyClient } from "./coolify.js";

class FakeCoolify extends CoolifyClient {
  constructor() {
    super({ baseUrl: "http://localhost", apiToken: "x" });
  }
  override async createProject(name: string) {
    return { uuid: `uuid-${name}`, name };
  }
}

describe("addProject", () => {
  it("creates the Coolify project then a Postgres database with the same slug", async () => {
    const adapter = new MockAdapter();
    adapter.programExec('docker exec postgres psql -U postgres -c "CREATE DATABASE euglow;"', {
      exitCode: 0,
    });
    const result = await addProject(adapter, {
      name: "euglow",
      coolify: new FakeCoolify(),
    });
    expect(result.project.uuid).toBe("uuid-euglow");
    expect(result.databaseCreated).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it("reports databaseCreated=false when psql fails", async () => {
    const adapter = new MockAdapter();
    adapter.programExec('docker exec postgres psql -U postgres -c "CREATE DATABASE euglow;"', {
      exitCode: 1,
      stderr: "exists\n",
    });
    const result = await addProject(adapter, {
      name: "euglow",
      coolify: new FakeCoolify(),
    });
    expect(result.databaseCreated).toBe(false);
    expect(result.exitCode).toBe(1);
  });
});
