import { describe, expect, it } from "vitest";

import { isSensitiveField, maskSensitiveValue } from "./sensitive.js";

describe("isSensitiveField", () => {
  it("matches paths containing 'token'", () => {
    expect(isSensitiveField("dns.api_token")).toBe(true);
    expect(isSensitiveField("github.access_token")).toBe(true);
  });

  it("matches paths containing 'secret'", () => {
    expect(isSensitiveField("supabase.jwt_secret")).toBe(true);
    expect(isSensitiveField("backups.r2.secret_access_key")).toBe(true);
    expect(isSensitiveField("supabase.service_role_key")).toBe(true);
  });

  it("matches paths containing 'password'", () => {
    expect(isSensitiveField("db.password")).toBe(true);
    expect(isSensitiveField("admin.passwd")).toBe(true);
  });

  it("matches paths containing 'api_key' or 'access_key'", () => {
    expect(isSensitiveField("openai.api_key")).toBe(true);
    expect(isSensitiveField("backups.r2.access_key_id")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSensitiveField("DNS.API_TOKEN")).toBe(true);
    expect(isSensitiveField("Supabase.JWT_Secret")).toBe(true);
  });

  it("does NOT match non-sensitive fields", () => {
    expect(isSensitiveField("project")).toBe(false);
    expect(isSensitiveField("domain")).toBe(false);
    expect(isSensitiveField("email")).toBe(false);
    expect(isSensitiveField("dns.zone")).toBe(false);
    expect(isSensitiveField("dns.provider")).toBe(false);
    expect(isSensitiveField("agent.bind")).toBe(false);
    expect(isSensitiveField("agent.port")).toBe(false);
  });

  it("matches even when only a sub-segment matches", () => {
    expect(isSensitiveField("foo.bar.api_token.baz")).toBe(true);
  });
});

describe("maskSensitiveValue", () => {
  it("masks short values entirely", () => {
    expect(maskSensitiveValue("")).toBe("***");
    expect(maskSensitiveValue("ab")).toBe("***");
    expect(maskSensitiveValue("abcd")).toBe("***");
  });

  it("shows last 3 characters for longer values", () => {
    expect(maskSensitiveValue("abcdefgh")).toBe("***...fgh");
    expect(maskSensitiveValue("cf-token-1234567890xyz")).toBe("***...xyz");
  });
});
