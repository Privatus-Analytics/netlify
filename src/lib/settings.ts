import { z } from "zod";

/**
 * The settings of the extension, their limits and how they combine.
 *
 * A project's settings come from up to three places, later ones win:
 *   1. the team defaults (Extensions, Privatus Analytics, Configuration)
 *   2. the project settings (Project configuration, Privatus Analytics)
 *   3. netlify.toml, under [[integrations]] with name "privatus-analytics"
 *
 * The extension only acts on a project that has a site ID from layer 2 or 3.
 */

/** The script and the optional modules are served from the tracker domain. */
export const SCRIPT_HOST = "https://privatusstats.com";

/** The tracker modules (docs: /docs/tracker/modules). */
export const MODULES = ["engage", "auto", "vitals", "clicks", "ask"] as const;
export type TrackerModule = (typeof MODULES)[number];

/** The same set the snippet in Site settings, Tracking lists. */
export const DEFAULT_MODULES: readonly TrackerModule[] = MODULES;

export const SPA_MODES = ["auto", "history", "hash", "off"] as const;
export type SpaMode = (typeof SPA_MODES)[number];

export const MODULE_LABELS: Record<TrackerModule, string> = {
  engage: "Time on page and scroll depth",
  auto: "Outbound links, downloads, forms and 404s (counted as events)",
  vitals: "Web Vitals",
  clicks: "Click maps",
  ask: "On-site surveys",
};

export const SITE_ID_PATTERN = /^pa_[A-Za-z0-9]{4,40}$/;
const GLOB_PATTERN = /^[A-Za-z0-9/_*?.\-~%:@!+]{1,200}$/;
const HOSTNAME_PATTERN = /^(localhost|(?=.{1,253}$)([A-Za-z0-9-]{1,63}\.)+[A-Za-z]{2,63})$/;

const siteId = z
  .string()
  .trim()
  .regex(SITE_ID_PATTERN, "The site ID looks like pa_7Q2K9XH3AB. Copy it from Site settings, Tracking in Privatus Analytics.");

const glob = z.string().trim().regex(GLOB_PATTERN, "Use letters, numbers and / * ? . - _ ~ % : @ ! + only.");
const hostname = z.string().trim().toLowerCase().regex(HOSTNAME_PATTERN, "Enter a hostname such as www.example.com.");

const optionalFields = {
  modules: z.array(z.enum(MODULES)).max(MODULES.length).optional(),
  spa: z.enum(SPA_MODES).optional(),
  /** Paths the tracker never counts (data-exclude), for example /admin/*. */
  exclude: z.array(glob).max(50).optional(),
  /** Hostnames the tracker counts on (data-domains). Empty means every hostname. */
  domains: z.array(hostname).max(50).optional(),
  /** HTML files in the publish directory that are left without the script. */
  skipFiles: z.array(glob).max(50).optional(),
  trackPreviews: z.boolean().optional(),
  trackBranchDeploys: z.boolean().optional(),
};

/** One project's settings. */
export const SiteConfigSchema = z.object({
  enabled: z.boolean().default(true),
  siteId,
  ...optionalFields,
});
export type SiteConfig = z.output<typeof SiteConfigSchema>;

/** Defaults for every project of the team. No site ID: that is per project. */
export const TeamConfigSchema = z.object({ ...optionalFields });
export type TeamConfig = z.output<typeof TeamConfigSchema>;

/** netlify.toml: the project settings with every field optional. */
export const BuildConfigSchema = z.object({
  enabled: z.boolean().optional(),
  siteId: siteId.optional(),
  ...optionalFields,
});
export type BuildConfig = z.output<typeof BuildConfigSchema>;

/** What the injector needs. Every field is decided. */
export interface Settings {
  siteId: string;
  modules: TrackerModule[];
  spa: SpaMode;
  exclude: string[];
  domains: string[];
  skipFiles: string[];
  trackPreviews: boolean;
  trackBranchDeploys: boolean;
}

export type Resolution =
  | { status: "ready"; settings: Settings }
  /** No site ID anywhere: the project did not set the extension up. Stay silent. */
  | { status: "not-configured" }
  | { status: "disabled" }
  | { status: "invalid"; message: string };

export interface Layers {
  team?: unknown;
  site?: unknown;
  build?: unknown;
}

const describe = (error: z.ZodError): string =>
  error.issues.map((issue) => `${issue.path.join(".") || "settings"}: ${issue.message}`).join(" ");

/** Parses a layer. `null` and `undefined` are an empty layer. Anything wrong is reported. */
const parseLayer = <T extends z.ZodTypeAny>(
  schema: T,
  value: unknown,
  name: string,
): { ok: true; data: z.output<T> | undefined } | { ok: false; message: string } => {
  if (value === null || value === undefined) return { ok: true, data: undefined };
  const result = schema.safeParse(value);
  if (!result.success) return { ok: false, message: `${name}: ${describe(result.error)}` };
  return { ok: true, data: result.data };
};

const pick = <K extends keyof Settings>(key: K, layers: Array<Partial<Settings> | undefined>): Settings[K] | undefined => {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const value = layers[i]?.[key];
    if (value !== undefined) return value;
  }
  return undefined;
};

export const resolveSettings = ({ team, site, build }: Layers): Resolution => {
  const teamLayer = parseLayer(TeamConfigSchema.partial(), team, "Team defaults");
  if (!teamLayer.ok) return { status: "invalid", message: teamLayer.message };
  // A project's saved settings are checked in full. A saved record that is not valid is reported.
  const siteLayer = parseLayer(SiteConfigSchema.partial(), site, "Project settings");
  if (!siteLayer.ok) return { status: "invalid", message: siteLayer.message };
  const buildLayer = parseLayer(BuildConfigSchema, build, "netlify.toml");
  if (!buildLayer.ok) return { status: "invalid", message: buildLayer.message };

  const layers = [teamLayer.data, siteLayer.data, buildLayer.data] as Array<Partial<Settings> | undefined>;
  const enabled = [siteLayer.data?.enabled, buildLayer.data?.enabled].reduce<boolean | undefined>(
    (current, next) => (next === undefined ? current : next),
    undefined,
  );
  const id = pick("siteId", layers);
  if (!id) return { status: "not-configured" };
  if (enabled === false) return { status: "disabled" };

  return {
    status: "ready",
    settings: {
      siteId: id,
      modules: dedupe(pick("modules", layers) ?? [...DEFAULT_MODULES]),
      spa: pick("spa", layers) ?? "auto",
      exclude: dedupe(pick("exclude", layers) ?? []),
      domains: dedupe(pick("domains", layers) ?? []),
      skipFiles: dedupe(pick("skipFiles", layers) ?? []),
      trackPreviews: pick("trackPreviews", layers) ?? false,
      trackBranchDeploys: pick("trackBranchDeploys", layers) ?? false,
    },
  };
};

const dedupe = <T,>(list: readonly T[]): T[] => [...new Set(list)];

/** The Netlify deploy contexts the script is added in. Production always, the rest by choice. */
export const contextAllowed = (context: string | undefined, settings: Pick<Settings, "trackPreviews" | "trackBranchDeploys">): boolean => {
  switch (context) {
    case "production":
      return true;
    case "deploy-preview":
      return settings.trackPreviews;
    case "branch-deploy":
      return settings.trackBranchDeploys;
    default:
      // dev (netlify dev), an unknown context, or no context at all.
      return false;
  }
};

/** "a, b\nc" -> ["a", "b", "c"]. For the form fields that take a list. */
export const parseList = (text: string): string[] =>
  text
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
