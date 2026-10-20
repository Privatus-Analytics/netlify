import { describe, expect, it } from "vitest";
import { contextAllowed, parseList, resolveSettings } from "../src/lib/settings.js";

const ready = (layers: Parameters<typeof resolveSettings>[0]) => {
  const result = resolveSettings(layers);
  if (result.status !== "ready") throw new Error(`expected ready, got ${JSON.stringify(result)}`);
  return result.settings;
};

describe("resolveSettings", () => {
  it("does nothing for a project without a site ID", () => {
    expect(resolveSettings({})).toEqual({ status: "not-configured" });
    expect(resolveSettings({ team: { spa: "off" } })).toEqual({ status: "not-configured" });
    expect(resolveSettings({ site: null, build: {} })).toEqual({ status: "not-configured" });
  });

  it("uses the recommended modules and plain defaults", () => {
    expect(ready({ site: { siteId: "pa_7Q2K9XH3AB" } })).toEqual({
      siteId: "pa_7Q2K9XH3AB",
      modules: ["engage", "auto", "vitals", "clicks", "ask"],
      spa: "auto",
      exclude: [],
      domains: [],
      skipFiles: [],
      trackPreviews: false,
      trackBranchDeploys: false,
    });
  });

  it("lets the project override the team and netlify.toml override both", () => {
    const settings = ready({
      team: { modules: ["engage"], spa: "history", exclude: ["/admin/*"] },
      site: { siteId: "pa_AAAA1111", spa: "hash", domains: ["www.example.com"] },
      build: { spa: "off" },
    });
    expect(settings.modules).toEqual(["engage"]);
    expect(settings.spa).toBe("off");
    expect(settings.exclude).toEqual(["/admin/*"]);
    expect(settings.domains).toEqual(["www.example.com"]);
  });

  it("accepts a site ID from netlify.toml alone", () => {
    expect(ready({ build: { siteId: "pa_AAAA1111", modules: [] } }).modules).toEqual([]);
  });

  it("can be turned off by the project or netlify.toml", () => {
    expect(resolveSettings({ site: { siteId: "pa_AAAA1111", enabled: false } })).toEqual({ status: "disabled" });
    expect(resolveSettings({ site: { siteId: "pa_AAAA1111" }, build: { enabled: false } })).toEqual({ status: "disabled" });
    expect(ready({ site: { siteId: "pa_AAAA1111", enabled: false }, build: { enabled: true } }).siteId).toBe("pa_AAAA1111");
  });

  it("reports invalid settings instead of guessing", () => {
    const bad = resolveSettings({ site: { siteId: "UA-12345-1" } });
    expect(bad.status).toBe("invalid");
    expect(bad.status === "invalid" && bad.message).toContain("Project settings: siteId");
    expect(resolveSettings({ site: { siteId: "pa_AAAA1111", modules: ["pixel"] } }).status).toBe("invalid");
    expect(resolveSettings({ site: { siteId: "pa_AAAA1111", exclude: ['"><script>'] } }).status).toBe("invalid");
    expect(resolveSettings({ site: { siteId: "pa_AAAA1111", domains: ["not a host"] } }).status).toBe("invalid");
    expect(resolveSettings({ build: { siteId: "x" } }).status).toBe("invalid");
  });

  it("removes duplicates", () => {
    expect(ready({ site: { siteId: "pa_AAAA1111", modules: ["auto", "auto", "engage"] } }).modules).toEqual(["auto", "engage"]);
  });
});

describe("contextAllowed", () => {
  const off = { trackPreviews: false, trackBranchDeploys: false };
  it("always tracks production", () => {
    expect(contextAllowed("production", off)).toBe(true);
  });
  it("tracks previews and branch deploys only when asked", () => {
    expect(contextAllowed("deploy-preview", off)).toBe(false);
    expect(contextAllowed("deploy-preview", { ...off, trackPreviews: true })).toBe(true);
    expect(contextAllowed("branch-deploy", off)).toBe(false);
    expect(contextAllowed("branch-deploy", { ...off, trackBranchDeploys: true })).toBe(true);
  });
  it("never tracks local development or an unknown context", () => {
    const all = { trackPreviews: true, trackBranchDeploys: true };
    expect(contextAllowed("dev", all)).toBe(false);
    expect(contextAllowed(undefined, all)).toBe(false);
  });
});

describe("parseList", () => {
  it("splits on lines and commas", () => {
    expect(parseList("/a/*, /b/*\n\n /c ")).toEqual(["/a/*", "/b/*", "/c"]);
    expect(parseList("")).toEqual([]);
  });
});
