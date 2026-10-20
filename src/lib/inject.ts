import { promises as fs } from "node:fs";
import path from "node:path";
import { globToRegExp, matchesAny } from "./glob.js";
import { injectIntoHtml } from "./html.js";
import { renderScriptTag } from "./snippet.js";
import type { Settings } from "./settings.js";

export interface InjectReport {
  /** HTML files looked at. */
  scanned: number;
  /** Files that got the script. */
  injected: number;
  /** Files that already load the tracker for this site. */
  alreadyPresent: number;
  /** Files left out by the Skip files setting. */
  skipped: number;
  /** Files with no <head>, such as fragments. */
  noHead: number;
  /** Files that load the tracker for a different site ID. Left alone. */
  otherSite: string[];
  /** Files that could not be read as UTF-8 text or could not be written. */
  failed: Array<{ file: string; reason: string }>;
}

const HTML_FILE = /\.html?$/i;
const IGNORED_DIRECTORIES = new Set(["node_modules", ".git"]);
/** Pages larger than this are not HTML pages worth touching. */
const MAX_BYTES = 10 * 1024 * 1024;

const walk = async function* (root: string, directory = ""): AsyncGenerator<string> {
  const entries = await fs.readdir(path.join(root, directory), { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const relative = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) yield* walk(root, relative);
    } else if (entry.isFile() && HTML_FILE.test(entry.name)) {
      // Symbolic links are skipped on purpose: a link could point outside the publish directory.
      yield relative;
    }
  }
};

/**
 * Adds the tracking script to every HTML file under `publishDir`.
 * Idempotent: running it twice changes nothing the second time.
 */
export const injectDirectory = async (publishDir: string, settings: Settings): Promise<InjectReport> => {
  const report: InjectReport = { scanned: 0, injected: 0, alreadyPresent: 0, skipped: 0, noHead: 0, otherSite: [], failed: [] };
  const skip = settings.skipFiles.map(globToRegExp);
  const tag = renderScriptTag(settings);

  for await (const relative of walk(publishDir)) {
    if (matchesAny(relative, skip)) {
      report.skipped += 1;
      continue;
    }
    report.scanned += 1;
    const file = path.join(publishDir, relative);
    try {
      const stat = await fs.stat(file);
      if (stat.size > MAX_BYTES) {
        report.failed.push({ file: relative, reason: "larger than 10 MB" });
        continue;
      }
      const buffer = await fs.readFile(file);
      const html = buffer.toString("utf8");
      // A file that is not valid UTF-8 would be damaged by a rewrite.
      if (!Buffer.from(html, "utf8").equals(buffer)) {
        report.failed.push({ file: relative, reason: "not UTF-8 text" });
        continue;
      }
      const result = injectIntoHtml(html, tag, settings.siteId);
      if (result.changed) {
        await fs.writeFile(file, result.html);
        report.injected += 1;
      } else if (result.reason === "already") {
        report.alreadyPresent += 1;
      } else if (result.reason === "other-site") {
        report.otherSite.push(relative);
      } else {
        report.noHead += 1;
      }
    } catch (error) {
      report.failed.push({ file: relative, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
};

/** A short account of a run, for the deploy summary. */
export const summarize = (report: InjectReport): string => {
  const parts = [`Added the script to ${report.injected} page${report.injected === 1 ? "" : "s"}.`];
  if (report.alreadyPresent) parts.push(`${report.alreadyPresent} already had it.`);
  if (report.skipped) parts.push(`${report.skipped} skipped by your settings.`);
  if (report.noHead) parts.push(`${report.noHead} had no head and were left alone.`);
  if (report.otherSite.length) parts.push(`${report.otherSite.length} load the tracker for another site ID and were left alone.`);
  if (report.failed.length) parts.push(`${report.failed.length} could not be changed.`);
  return parts.join(" ");
};
