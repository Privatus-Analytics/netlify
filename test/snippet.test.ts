import { describe, expect, it } from "vitest";
import { renderScriptTag } from "../src/lib/snippet.js";
import type { Settings } from "../src/lib/settings.js";

const base: Settings = {
  siteId: "pa_7Q2K9XH3AB",
  modules: ["engage", "auto", "vitals", "clicks", "ask"],
  spa: "auto",
  exclude: [],
  domains: [],
  skipFiles: [],
  trackPreviews: false,
  trackBranchDeploys: false,
};

describe("renderScriptTag", () => {
  it("is the documented tag", () => {
    expect(renderScriptTag(base)).toBe(
      '<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_7Q2K9XH3AB" data-modules="engage,auto,vitals,clicks,ask"></script>',
    );
  });

  it("writes only the options that differ", () => {
    const tag = renderScriptTag({ ...base, modules: ["engage"], spa: "hash", exclude: ["/admin/*", "/preview/*"], domains: ["www.example.com"] });
    expect(tag).toBe(
      '<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_7Q2K9XH3AB" data-modules="engage" data-spa="hash" data-exclude="/admin/*,/preview/*" data-domains="www.example.com"></script>',
    );
  });

  it("keeps an empty module list explicit, because leaving it out would turn engage on", () => {
    expect(renderScriptTag({ ...base, modules: [] })).toContain('data-modules=""');
  });

  it("escapes attribute values", () => {
    expect(renderScriptTag({ ...base, exclude: ['/a"b'] })).toContain('data-exclude="/a&quot;b"');
  });

  it("has no inline code, cookie or storage use", () => {
    const tag = renderScriptTag(base);
    expect(tag).not.toMatch(/localStorage|document\.cookie|fetch\(/);
    expect(tag.match(/<script/g)).toHaveLength(1);
  });
});
