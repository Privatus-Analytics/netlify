import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { injectDirectory, summarize } from "../src/lib/inject.js";
import { resolveSettings, type Settings } from "../src/lib/settings.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "privatus-netlify-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const settings = (extra: Record<string, unknown> = {}): Settings => {
  const result = resolveSettings({ site: { siteId: "pa_7Q2K9XH3AB", ...extra } });
  if (result.status !== "ready") throw new Error(JSON.stringify(result));
  return result.settings;
};
const put = async (file: string, content: string | Buffer) => {
  await mkdir(path.dirname(path.join(dir, file)), { recursive: true });
  await writeFile(path.join(dir, file), content);
};
const read = (file: string) => readFile(path.join(dir, file), "utf8");
const PAGE = "<!doctype html><html><head><title>x</title></head><body>hi</body></html>";

describe("injectDirectory", () => {
  it("adds the script to every page, nested ones too, and nothing else", async () => {
    await put("index.html", PAGE);
    await put("blog/post/index.html", PAGE);
    await put("about.htm", PAGE);
    await put("style.css", "body{}");
    await put("data.json", "{}");

    const report = await injectDirectory(dir, settings());
    expect(report).toMatchObject({ scanned: 3, injected: 3, alreadyPresent: 0, skipped: 0, noHead: 0, failed: [] });
    for (const file of ["index.html", "blog/post/index.html", "about.htm"]) {
      expect(await read(file)).toContain('<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_7Q2K9XH3AB"');
    }
    expect(await read("style.css")).toBe("body{}");
  });

  it("is idempotent across builds", async () => {
    await put("index.html", PAGE);
    await injectDirectory(dir, settings());
    const once = await read("index.html");
    const report = await injectDirectory(dir, settings());
    expect(report).toMatchObject({ injected: 0, alreadyPresent: 1 });
    expect(await read("index.html")).toBe(once);
    expect(once.match(/pa\.js/g)).toHaveLength(1);
  });

  it("honors skip patterns", async () => {
    await put("index.html", PAGE);
    await put("admin/index.html", PAGE);
    await put("drafts/a.html", PAGE);
    const report = await injectDirectory(dir, settings({ skipFiles: ["admin/**", "drafts/*.html"] }));
    expect(report).toMatchObject({ scanned: 1, injected: 1, skipped: 2 });
    expect(await read("admin/index.html")).toBe(PAGE);
  });

  it("leaves fragments, other site IDs and non UTF-8 files untouched", async () => {
    const other = '<head><script defer src="https://privatusstats.com/js/pa.js" data-site="pa_OTHER999"></script></head>';
    const latin1 = Buffer.concat([Buffer.from("<html><head><title>"), Buffer.from([0xe9]), Buffer.from("</title></head></html>")]);
    await put("fragment.html", "<div>x</div>");
    await put("other.html", other);
    await put("latin1.html", latin1);

    const report = await injectDirectory(dir, settings());
    expect(report.injected).toBe(0);
    expect(report.noHead).toBe(1);
    expect(report.otherSite).toEqual(["other.html"]);
    expect(report.failed).toEqual([{ file: "latin1.html", reason: "not UTF-8 text" }]);
    expect(await read("fragment.html")).toBe("<div>x</div>");
    expect(await read("other.html")).toBe(other);
    expect((await readFile(path.join(dir, "latin1.html"))).equals(latin1)).toBe(true);
  });

  it("does not follow symbolic links out of the publish directory", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "privatus-outside-"));
    try {
      await writeFile(path.join(outside, "secret.html"), PAGE);
      await symlink(path.join(outside, "secret.html"), path.join(dir, "link.html"));
      await symlink(outside, path.join(dir, "linked-dir"));
      const report = await injectDirectory(dir, settings());
      expect(report.scanned).toBe(0);
      expect(await readFile(path.join(outside, "secret.html"), "utf8")).toBe(PAGE);
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("skips node_modules and .git", async () => {
    await put("node_modules/pkg/index.html", PAGE);
    await put(".git/x.html", PAGE);
    expect((await injectDirectory(dir, settings())).scanned).toBe(0);
  });

  it("passes the options to the tag", async () => {
    await put("index.html", PAGE);
    await injectDirectory(dir, settings({ modules: ["engage"], spa: "off", exclude: ["/admin/*"] }));
    expect(await read("index.html")).toContain('data-modules="engage" data-spa="off" data-exclude="/admin/*"');
  });
});

describe("summarize", () => {
  it("is plain sentences", () => {
    expect(summarize({ scanned: 5, injected: 1, alreadyPresent: 2, skipped: 1, noHead: 1, otherSite: ["a.html"], failed: [] })).toBe(
      "Added the script to 1 page. 2 already had it. 1 skipped by your settings. 1 had no head and were left alone. 1 load the tracker for another site ID and were left alone.",
    );
    expect(summarize({ scanned: 0, injected: 0, alreadyPresent: 0, skipped: 0, noHead: 0, otherSite: [], failed: [] })).toBe("Added the script to 0 pages.");
  });
});
