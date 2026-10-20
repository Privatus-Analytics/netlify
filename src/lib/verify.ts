import { detectTracker } from "./html.js";

export type VerifyResult =
  | { status: "found"; siteId: string | null; matches: boolean }
  | { status: "not-found" }
  | { status: "unreachable"; message: string };

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Loads the project's published home page and looks for the tracking
 * script. Reads one public page and sends nothing about the visitor or the
 * project to Privatus Analytics.
 */
export const verifyPublishedPage = async (
  url: string,
  expectedSiteId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<VerifyResult> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { status: "unreachable", message: "The project has no published address yet." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { status: "unreachable", message: "The project address is not a web address." };
  }

  let response: Response;
  try {
    response = await fetchImpl(parsed, { redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { accept: "text/html" } });
  } catch (error) {
    return { status: "unreachable", message: error instanceof Error ? error.message : "The page could not be loaded." };
  }
  if (!response.ok) return { status: "unreachable", message: `The page responded with ${response.status}.` };

  const html = (await response.text()).slice(0, MAX_BYTES);
  const found = detectTracker(html);
  if (!found.present) return { status: "not-found" };
  return { status: "found", siteId: found.siteId ?? null, matches: found.siteId === expectedSiteId };
};
