import { describe, expect, it } from "vitest";
import { emptyForm, fromFormValues, toFormValues } from "../src/lib/form.js";
import { SiteConfigSchema } from "../src/lib/settings.js";

describe("settings forms", () => {
  it("starts with the recommended modules on", () => {
    const form = emptyForm();
    expect([form.engage, form.auto, form.vitals, form.clicks, form.ask]).toEqual([true, true, true, true, true]);
    expect(form.enabled).toBe(true);
  });

  it("round trips a saved configuration", () => {
    const saved = SiteConfigSchema.parse({
      siteId: "pa_7Q2K9XH3AB",
      modules: ["engage", "vitals"],
      spa: "history",
      exclude: ["/admin/*"],
      domains: ["www.example.com", "example.com"],
      skipFiles: ["drafts/**"],
      trackPreviews: true,
    });
    const form = toFormValues(saved);
    expect(form).toMatchObject({ engage: true, auto: false, vitals: true, clicks: false, ask: false, exclude: "/admin/*", domains: "www.example.com\nexample.com" });
    expect(SiteConfigSchema.parse(fromFormValues(form))).toEqual({ ...saved, trackBranchDeploys: false });
  });

  it("turns typed lists into validated settings", () => {
    const form = { ...emptyForm(), siteId: " pa_7Q2K9XH3AB ", exclude: "/a/*, /b/*", domains: "Example.com" };
    const parsed = SiteConfigSchema.parse(fromFormValues(form));
    expect(parsed.siteId).toBe("pa_7Q2K9XH3AB");
    expect(parsed.exclude).toEqual(["/a/*", "/b/*"]);
    expect(parsed.domains).toEqual(["example.com"]);
  });

  it("rejects a bad site ID with a message a person can act on", () => {
    const result = SiteConfigSchema.safeParse(fromFormValues({ ...emptyForm(), siteId: "G-ABC123" }));
    expect(result.success).toBe(false);
    expect(!result.success && result.error.issues[0]?.message).toContain("pa_");
  });
});
