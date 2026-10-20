import { SCRIPT_HOST, type Settings } from "./settings.js";

const escapeAttribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The tracking script tag, as the install docs show it:
 *   <script defer src="https://privatusstats.com/js/pa.js" data-site="pa_..." data-modules="..."></script>
 * Only options that differ from the tracker's defaults are written, except
 * data-modules, which always lists the modules (setting it replaces the default).
 */
export const renderScriptTag = (settings: Settings, host: string = SCRIPT_HOST): string => {
  const attributes: Array<[string, string | null]> = [
    ["defer", null],
    ["src", `${host.replace(/\/+$/, "")}/js/pa.js`],
    ["data-site", settings.siteId],
    ["data-modules", settings.modules.join(",")],
  ];
  if (settings.spa !== "auto") attributes.push(["data-spa", settings.spa]);
  if (settings.exclude.length > 0) attributes.push(["data-exclude", settings.exclude.join(",")]);
  if (settings.domains.length > 0) attributes.push(["data-domains", settings.domains.join(",")]);

  const html = attributes
    .map(([name, value]) => (value === null ? name : `${name}="${escapeAttribute(value)}"`))
    .join(" ");
  return `<script ${html}></script>`;
};
