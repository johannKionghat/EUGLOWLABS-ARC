export interface CoolifyClientOptions {
  baseUrl: string;
  apiToken: string;
}

export interface CoolifyProject {
  uuid: string;
  name: string;
}

interface CoolifyCreateProjectResponse {
  uuid: string;
  name: string;
}

/**
 * Tiny client for Coolify's REST API.
 *
 * Per ADR-0005 we never fork Coolify; we consume its public API. This
 * wrapper covers only the calls the arc CLI needs today. Endpoints
 * follow the v4 surface; adjust `version` as needed if Coolify evolves.
 */
export class CoolifyClient {
  constructor(private readonly opts: CoolifyClientOptions) {}

  async createProject(name: string): Promise<CoolifyProject> {
    const response = await fetch(`${this.opts.baseUrl}/api/v1/projects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Coolify createProject failed (${response.status}): ${body}`);
    }
    const data = (await response.json()) as CoolifyCreateProjectResponse;
    return { uuid: data.uuid, name: data.name };
  }

  async listProjects(): Promise<CoolifyProject[]> {
    const response = await fetch(`${this.opts.baseUrl}/api/v1/projects`, {
      headers: { Authorization: `Bearer ${this.opts.apiToken}` },
    });
    if (!response.ok) {
      throw new Error(`Coolify listProjects failed (${response.status})`);
    }
    const data = (await response.json()) as CoolifyProject[];
    return data.map((p) => ({ uuid: p.uuid, name: p.name }));
  }

  async deployProject(uuid: string): Promise<void> {
    const response = await fetch(`${this.opts.baseUrl}/api/v1/projects/${uuid}/deploy`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.apiToken}` },
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Coolify deployProject failed (${response.status}): ${body}`);
    }
  }
}
