import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runBuild, type BuildInput } from "../src/lib/build.js";

let dir: string;
const PAGE = "<html><head><title>x</title></head><body></body></html>";
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "privatus-build-"));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), PAGE);
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const run = async (overrides: Partial<BuildInput> & { site?: unknown; team?: unknown } = {}) => {
  const show = vi.fn();
  const failPlugin = vi.fn();
  const { site, team, ...rest } = overrides;
  const client = {
    getTeamConfiguration: vi.fn(async () => (team === undefined ? null : { config: team })),
    getSiteConfiguration: vi.fn(async () => (site === undefined ? null : { config: site })),
  };
  await runBuild({
    client,
    buildConfig: {},
    constants: { ACCOUNT_ID: "acct", SITE_ID: "site", PUBLISH_DIR: dir },
    utils: { status: { show }, build: { failPlugin } },
    env: { CONTEXT: "production" },
    ...rest,
  });
  return { show, failPlugin, client, html: await readFile(path.join(dir, "index.html"), "utf8") };
};

describe("runBuild", () => {
  it("is silent and changes nothing for a project that is not set up", async () => {
    const { show, failPlugin, html } = await run();
    expect(show).not.toHaveBeenCalled();
    expect(failPlugin).not.toHaveBeenCalled();
    expect(html).toBe(PAGE);
  });

  it("adds the script for a project with a saved site ID", async () => {
    const { show, html } = await run({ site: { siteId: "pa_7Q2K9XH3AB" } });
    expect(html).toContain('data-site="pa_7Q2K9XH3AB"');
    expect(show).toHaveBeenCalledWith({ title: "Privatus Analytics", summary: "Added the script to 1 page." });
  });

  it("reads the site ID from netlify.toml when nothing is saved", async () => {
    const { html } = await run({ buildConfig: { siteId: "pa_AAAA1111" } });
    expect(html).toContain('data-site="pa_AAAA1111"');
  });

  it("works without an account ID, from netlify.toml alone", async () => {
    const { html, client } = await run({
      buildConfig: { siteId: "pa_AAAA1111" },
      constants: { SITE_ID: "site", PUBLISH_DIR: dir },
    });
    expect(html).toContain("pa_AAAA1111");
    expect(client.getSiteConfiguration).not.toHaveBeenCalled();
  });

  it("keeps going when the saved settings cannot be read", async () => {
    const show = vi.fn();
    await runBuild({
      client: { getTeamConfiguration: async () => { throw new Error("down"); }, getSiteConfiguration: async () => { throw new Error("down"); } },
      buildConfig: { siteId: "pa_AAAA1111" },
      constants: { ACCOUNT_ID: "a", SITE_ID: "s", PUBLISH_DIR: dir },
      utils: { status: { show }, build: { failPlugin: vi.fn() } },
      env: { CONTEXT: "production" },
    });
    expect(await readFile(path.join(dir, "index.html"), "utf8")).toContain("pa_AAAA1111");
  });

  it("skips previews unless asked", async () => {
    const skipped = await run({ site: { siteId: "pa_AAAA1111" }, env: { CONTEXT: "deploy-preview" } });
    expect(skipped.html).toBe(PAGE);
    expect(skipped.show.mock.calls[0]?.[0].summary).toContain("deploy-preview build");
    const tracked = await run({ site: { siteId: "pa_AAAA1111", trackPreviews: true }, env: { CONTEXT: "deploy-preview" } });
    expect(tracked.html).toContain("pa_AAAA1111");
  });

  it("applies team defaults", async () => {
    const { html } = await run({ team: { modules: ["engage"] }, site: { siteId: "pa_AAAA1111" } });
    expect(html).toContain('data-modules="engage"');
  });

  it("reports invalid settings in the summary and does not fail the build", async () => {
    const { show, failPlugin, html } = await run({ site: { siteId: "nope" } });
    expect(html).toBe(PAGE);
    expect(failPlugin).not.toHaveBeenCalled();
    expect(show.mock.calls[0]?.[0].summary).toContain("The script was not added.");
  });

  it("does nothing when the project turned it off", async () => {
    const { show, html } = await run({ site: { siteId: "pa_AAAA1111", enabled: false } });
    expect(html).toBe(PAGE);
    expect(show).not.toHaveBeenCalled();
  });

  it("turns a crash into a plugin failure, never a failed deploy", async () => {
    const failPlugin = vi.fn();
    await runBuild({
      client: { getTeamConfiguration: async () => null, getSiteConfiguration: async () => null },
      buildConfig: { siteId: "pa_AAAA1111" },
      constants: { SITE_ID: "s", PUBLISH_DIR: path.join(dir, "missing") },
      utils: { status: { show: vi.fn() }, build: { failPlugin } },
      env: { CONTEXT: "production" },
    });
    expect(failPlugin).toHaveBeenCalledTimes(1);
    expect(failPlugin.mock.calls[0]?.[0]).toContain("could not add the script");
  });
});
