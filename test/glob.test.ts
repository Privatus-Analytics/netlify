import { describe, expect, it } from "vitest";
import { globToRegExp } from "../src/lib/glob.js";

const match = (glob: string, path: string) => globToRegExp(glob).test(path);

describe("globToRegExp", () => {
  it("matches a file name anywhere when there is no slash", () => {
    expect(match("draft.html", "draft.html")).toBe(true);
    expect(match("draft.html", "blog/draft.html")).toBe(true);
    expect(match("draft.html", "blog/notdraft.html")).toBe(false);
  });
  it("matches a directory with a trailing slash or **", () => {
    expect(match("admin/", "admin/index.html")).toBe(true);
    expect(match("admin/**", "admin/a/b.html")).toBe(true);
    expect(match("admin/**", "administrator/index.html")).toBe(false);
    expect(match("/admin/**", "admin/index.html")).toBe(true);
  });
  it("* stays inside one directory", () => {
    expect(match("drafts/*.html", "drafts/a.html")).toBe(true);
    expect(match("drafts/*.html", "drafts/x/a.html")).toBe(false);
  });
  it("**/ also matches no directory", () => {
    expect(match("**/print.html", "print.html")).toBe(true);
    expect(match("**/print.html", "a/b/print.html")).toBe(true);
  });
  it("treats other characters literally", () => {
    expect(match("a.b+c.html", "a.b+c.html")).toBe(true);
    expect(match("a.b+c.html", "aXb+c.html")).toBe(false);
    expect(match("file?.html", "file1.html")).toBe(true);
  });
});
