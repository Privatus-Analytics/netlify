import { describe, expect, it, vi } from "vitest";
import { verifyPublishedPage } from "../src/lib/verify.js";

const page = (html: string, status = 200) => vi.fn(async () => new Response(html, { status })) as unknown as typeof fetch;
const TAG = '<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_AAAA1111"></script>';

describe("verifyPublishedPage", () => {
  it("finds the script with the expected site ID", async () => {
    expect(await verifyPublishedPage("https://example.com", "pa_AAAA1111", page(`<head>${TAG}</head>`))).toEqual({
      status: "found",
      siteId: "pa_AAAA1111",
      matches: true,
    });
  });
  it("flags a different site ID", async () => {
    expect(await verifyPublishedPage("https://example.com", "pa_ZZZZ9999", page(`<head>${TAG}</head>`))).toMatchObject({ status: "found", matches: false });
  });
  it("reports a page without the script", async () => {
    expect(await verifyPublishedPage("https://example.com", "pa_AAAA1111", page("<head></head>"))).toEqual({ status: "not-found" });
  });
  it("reports errors in plain words", async () => {
    expect(await verifyPublishedPage("https://example.com", "pa_AAAA1111", page("", 503))).toEqual({ status: "unreachable", message: "The page responded with 503." });
    expect((await verifyPublishedPage("ftp://example.com", "pa_AAAA1111", page(""))).status).toBe("unreachable");
    expect((await verifyPublishedPage("not a url", "pa_AAAA1111", page(""))).status).toBe("unreachable");
    const failing = vi.fn(async () => { throw new Error("getaddrinfo ENOTFOUND"); }) as unknown as typeof fetch;
    expect(await verifyPublishedPage("https://example.com", "pa_AAAA1111", failing)).toEqual({ status: "unreachable", message: "getaddrinfo ENOTFOUND" });
  });
});
