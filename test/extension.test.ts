import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extension } from "../src/index.js";

describe("the extension", () => {
  it("registers one build event handler, after the build", () => {
    const hooks = extension.buildHooks;
    expect(hooks.onPostBuild).toBeTypeOf("function");
    expect(hooks.onPreBuild).toBeNull();
    expect(hooks.onBuild).toBeNull();
  });

  it("asks for the least access it needs", () => {
    const yaml = readFileSync(new URL("../extension.yaml", import.meta.url), "utf8");
    expect(yaml).toMatch(/scopes:\s+site:\s+- read\s+ui:/);
    expect(yaml).not.toMatch(/\b(write|env|user)\b/);
  });
});
