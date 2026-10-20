import { describe, expect, it } from "vitest";
import { detectTracker, injectIntoHtml } from "../src/lib/html.js";

const TAG = '<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_AAAA1111"></script>';
const inject = (html: string) => injectIntoHtml(html, TAG, "pa_AAAA1111");

describe("injectIntoHtml", () => {
  it("adds the tag on its own line before </head>", () => {
    const result = inject("<!doctype html>\n<html>\n<head>\n  <title>Hi</title>\n</head>\n<body></body>\n</html>\n");
    expect(result).toEqual({
      changed: true,
      html: `<!doctype html>\n<html>\n<head>\n  <title>Hi</title>\n  ${TAG}\n</head>\n<body></body>\n</html>\n`,
    });
  });

  it("works on a minified page", () => {
    const result = inject("<html><head><title>x</title></head><body>b</body></html>");
    expect(result).toEqual({ changed: true, html: `<html><head><title>x</title>${TAG}</head><body>b</body></html>` });
  });

  it("is case insensitive and keeps CRLF line ends", () => {
    const result = inject("<HTML>\r\n<HEAD>\r\n</HEAD>\r\n</HTML>");
    expect(result.changed && result.html).toBe(`<HTML>\r\n<HEAD>\r\n  ${TAG}\r\n</HEAD>\r\n</HTML>`);
  });

  it("ignores </head> in comments and scripts", () => {
    const html = "<head><!-- </head> --><script>var s = '</head>';</script><title>t</title></head><body></body>";
    const result = inject(html);
    expect(result.changed && result.html).toBe(`<head><!-- </head> --><script>var s = '</head>';</script><title>t</title>${TAG}</head><body></body>`);
  });

  it("uses the start of <head> when </head> is left out", () => {
    const result = inject("<html><head><title>x</title><body>b</body></html>");
    expect(result.changed && result.html).toBe(`<html><head>${TAG}<title>x</title><body>b</body></html>`);
  });

  it("does not mistake <header> for <head>", () => {
    expect(inject("<body><header>x</header></body>")).toEqual({ changed: false, reason: "no-head" });
  });

  it("leaves a fragment alone", () => {
    expect(inject("<div>partial</div>")).toEqual({ changed: false, reason: "no-head" });
  });

  it("is idempotent", () => {
    const first = inject("<head></head>");
    if (!first.changed) throw new Error("expected a change");
    expect(inject(first.html)).toEqual({ changed: false, reason: "already" });
  });

  it("leaves a page alone that loads the tracker for another site", () => {
    const html = '<head><script defer src="https://privatusstats.com/js/pa.js" data-site="pa_OTHER999"></script></head>';
    expect(inject(html)).toEqual({ changed: false, reason: "other-site", existingSiteId: "pa_OTHER999" });
  });

  it("does not count a commented-out script as installed", () => {
    expect(inject(`<head><!-- ${TAG} --></head>`).changed).toBe(true);
  });
});

describe("detectTracker", () => {
  it("finds the tag with attributes in any order and quote style", () => {
    expect(detectTracker('<script data-site=pa_BBBB2222 defer src=/js/pa.js></script>')).toEqual({ present: true, siteId: "pa_BBBB2222" });
    expect(detectTracker("<script src='https://stats.example.com/js/pa.js?v=3' data-site='pa_CCCC3333'></script>")).toEqual({
      present: true,
      siteId: "pa_CCCC3333",
    });
  });
  it("finds the loader snippet of the framework packages", () => {
    const html = `<script>(function(){var a={"src":"https://privatusstats.com/js/pa.js","data-site":"pa_DDDD4444"};s.setAttribute('data-privatus-loader',n)})();</script>`;
    expect(detectTracker(html)).toEqual({ present: true, siteId: "pa_DDDD4444" });
  });
  it("is false for other scripts", () => {
    expect(detectTracker('<script src="/js/app.js"></script><script src="/js/pa.json.js"></script>')).toEqual({ present: false });
  });
});
