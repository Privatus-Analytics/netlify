import { z } from "zod";
import {
  DEFAULT_MODULES,
  MODULES,
  SPA_MODES,
  parseList,
  type SiteConfig,
  type SpaMode,
  type TeamConfig,
  type TrackerModule,
} from "./settings.js";

/**
 * The settings forms use plain values (a checkbox per module, one text box
 * per list). These functions convert between that and the saved settings.
 */
export const FormSchema = z.object({
  enabled: z.boolean(),
  siteId: z.string(),
  engage: z.boolean(),
  auto: z.boolean(),
  vitals: z.boolean(),
  clicks: z.boolean(),
  ask: z.boolean(),
  spa: z.enum(SPA_MODES),
  exclude: z.string(),
  domains: z.string(),
  skipFiles: z.string(),
  trackPreviews: z.boolean(),
  trackBranchDeploys: z.boolean(),
});
export type FormValues = z.output<typeof FormSchema>;

export const emptyForm = (): FormValues => ({
  enabled: true,
  siteId: "",
  ...Object.fromEntries(MODULES.map((name) => [name, DEFAULT_MODULES.includes(name)])),
  spa: "auto",
  exclude: "",
  domains: "",
  skipFiles: "",
  trackPreviews: false,
  trackBranchDeploys: false,
} as FormValues);

export const toFormValues = (config: Partial<SiteConfig & TeamConfig> | null | undefined): FormValues => {
  const base = emptyForm();
  if (!config) return base;
  const modules = config.modules ?? [...DEFAULT_MODULES];
  return {
    ...base,
    enabled: config.enabled ?? true,
    siteId: config.siteId ?? "",
    ...(Object.fromEntries(MODULES.map((name) => [name, modules.includes(name)])) as Record<TrackerModule, boolean>),
    spa: (config.spa ?? "auto") as SpaMode,
    exclude: (config.exclude ?? []).join("\n"),
    domains: (config.domains ?? []).join("\n"),
    skipFiles: (config.skipFiles ?? []).join("\n"),
    trackPreviews: config.trackPreviews ?? false,
    trackBranchDeploys: config.trackBranchDeploys ?? false,
  };
};

/** The raw settings object for a form (not yet validated: pass it to the schema). */
export const fromFormValues = (values: FormValues): Record<string, unknown> => ({
  enabled: values.enabled,
  siteId: values.siteId.trim(),
  modules: MODULES.filter((name) => values[name]),
  spa: values.spa,
  exclude: parseList(values.exclude),
  domains: parseList(values.domains),
  skipFiles: parseList(values.skipFiles),
  trackPreviews: values.trackPreviews,
  trackBranchDeploys: values.trackBranchDeploys,
});
