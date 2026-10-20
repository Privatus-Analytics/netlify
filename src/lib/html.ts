/**
 * Finding the right place in an HTML document and detecting a script that
 * is already there. No HTML parser: a scan that knows comments and the
 * elements whose content is raw text is enough for the one place we need.
 */

/** Index ranges that are inside comments or raw text elements. */
const blindRanges = (html: string): Array<[number, number]> => {
  const ranges: Array<[number, number]> = [];
  const re = /<!--[\s\S]*?(?:-->|$)|<(script|style|textarea|title)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    ranges.push([match.index, match.index + match[0].length]);
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return ranges;
};

const insideAny = (index: number, ranges: Array<[number, number]>): boolean => ranges.some(([start, end]) => index >= start && index < end);

/** The first match of `re` that is not in a comment or in script, style, textarea or title. */
const firstOutside = (html: string, re: RegExp): RegExpExecArray | null => {
  const ranges = blindRanges(html);
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = global.exec(html))) {
    if (!insideAny(match.index, ranges)) return match;
    if (match[0].length === 0) global.lastIndex += 1;
  }
  return null;
};

/** The text with comments removed, so a commented-out script does not count. */
const withoutComments = (html: string): string => html.replace(/<!--[\s\S]*?(?:-->|$)/g, "");

export interface TrackerPresence {
  present: boolean;
  /** The data-site of the script tag, when it could be read. */
  siteId?: string;
}

const SCRIPT_TAG = /<script\b[^>]*>/gi;
const TRACKER_SRC = /\bsrc\s*=\s*(?:"[^"]*\/js\/pa\.js(?:[?#][^"]*)?"|'[^']*\/js\/pa\.js(?:[?#][^']*)?'|[^\s"'>]*\/js\/pa\.js(?:[?#][^\s>]*)?(?=[\s>]))/i;
const DATA_SITE = /\bdata-site\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;

/**
 * Is a Privatus Analytics tracker script in this document? A script tag
 * whose src ends in /js/pa.js (any host, so a copy you host yourself counts),
 * or the loader snippet the framework packages write.
 */
export const detectTracker = (html: string): TrackerPresence => {
  const text = withoutComments(html);
  let match: RegExpExecArray | null;
  const tags = new RegExp(SCRIPT_TAG.source, "gi");
  while ((match = tags.exec(text))) {
    const tag = match[0];
    if (TRACKER_SRC.test(tag)) {
      const site = DATA_SITE.exec(tag);
      const siteId = site ? (site[1] ?? site[2] ?? site[3]) : undefined;
      return siteId ? { present: true, siteId } : { present: true };
    }
  }
  if (/data-privatus-loader/.test(text) && /\/js\/pa\.js/.test(text)) {
    const inline = /"data-site"\s*:\s*"([^"]+)"/.exec(text);
    return inline && inline[1] ? { present: true, siteId: inline[1] } : { present: true };
  }
  return { present: false };
};

export type InjectResult =
  | { changed: true; html: string }
  | { changed: false; reason: "already" | "other-site" | "no-head"; existingSiteId?: string };

/**
 * Puts `tag` at the end of <head>, just before </head>. A document that
 * leaves out </head> (HTML allows it) gets the tag right after <head>. A
 * document with no head, or one that already loads the tracker, is left alone.
 */
export const injectIntoHtml = (html: string, tag: string, siteId: string): InjectResult => {
  const existing = detectTracker(html);
  if (existing.present) {
    if (existing.siteId && existing.siteId !== siteId) return { changed: false, reason: "other-site", existingSiteId: existing.siteId };
    return { changed: false, reason: "already" };
  }

  const close = firstOutside(html, /<\/head\s*>/i);
  if (close) {
    const lineStart = html.lastIndexOf("\n", close.index - 1) + 1;
    const beforeOnLine = html.slice(lineStart, close.index);
    if (beforeOnLine.trim() === "") {
      // </head> on its own line: the tag gets its own line, indented one step deeper.
      const newline = html.includes("\r\n") ? "\r\n" : "\n";
      return { changed: true, html: `${html.slice(0, lineStart)}${beforeOnLine}  ${tag}${newline}${html.slice(lineStart)}` };
    }
    return { changed: true, html: `${html.slice(0, close.index)}${tag}${html.slice(close.index)}` };
  }

  const open = firstOutside(html, /<head(?=[\s>])[^>]*>/i);
  if (open) {
    const at = open.index + open[0].length;
    return { changed: true, html: `${html.slice(0, at)}${tag}${html.slice(at)}` };
  }
  return { changed: false, reason: "no-head" };
};

