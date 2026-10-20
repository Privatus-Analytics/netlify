import { injectDirectory, summarize } from "./inject.js";
import { contextAllowed, resolveSettings } from "./settings.js";

/** The part of the build client the handler uses. */
export interface ConfigClient {
  getTeamConfiguration(teamId: string): Promise<{ config: unknown } | null>;
  getSiteConfiguration(teamId: string, siteId: string): Promise<{ config: unknown } | null>;
}

export interface BuildUtils {
  status: { show(options: { title: string; summary: string; text?: string }): void };
  build: { failPlugin(message: string): void };
}

export interface BuildInput {
  client: ConfigClient;
  /** The netlify.toml [[integrations]] config, already parsed. */
  buildConfig: unknown;
  constants: { ACCOUNT_ID?: string | undefined; SITE_ID: string; PUBLISH_DIR: string };
  utils: BuildUtils;
  /** The build environment. CONTEXT is production, deploy-preview or branch-deploy. */
  env: Record<string, string | undefined>;
}

/**
 * What runs after a build. Quiet when the project has not been set up, so
 * a team-wide install costs the other projects nothing. A failure never
 * stops the deploy: it is reported as a plugin failure.
 */
export const runBuild = async ({ client, buildConfig, constants, utils, env }: BuildInput): Promise<void> => {
  try {
    const { ACCOUNT_ID: accountId, SITE_ID: siteId, PUBLISH_DIR: publishDir } = constants;

    let team: unknown;
    let site: unknown;
    if (accountId) {
      const [teamConfig, siteConfig] = await Promise.all([
        client.getTeamConfiguration(accountId).catch(() => null),
        client.getSiteConfiguration(accountId, siteId).catch(() => null),
      ]);
      team = teamConfig?.config;
      site = siteConfig?.config;
    }

    const resolution = resolveSettings({ team, site, build: buildConfig });
    if (resolution.status === "not-configured" || resolution.status === "disabled") return;
    if (resolution.status === "invalid") {
      utils.status.show({ title: "Privatus Analytics", summary: `The script was not added. ${resolution.message}` });
      return;
    }

    const { settings } = resolution;
    const context = env["CONTEXT"];
    if (!contextAllowed(context, settings)) {
      utils.status.show({
        title: "Privatus Analytics",
        summary: `The script was not added to this ${context ?? "local"} build. Turn on Deploy Previews or branch deploys in the project settings to track them.`,
      });
      return;
    }

    const report = await injectDirectory(publishDir, settings);
    utils.status.show({
      title: "Privatus Analytics",
      summary: summarize(report),
      ...(report.failed.length ? { text: report.failed.map((item) => `${item.file}: ${item.reason}`).join("\n") } : {}),
    });
    if (report.otherSite.length) {
      console.warn(`[Privatus Analytics] ${report.otherSite.length} page(s) already load the tracker for a different site ID: ${report.otherSite.slice(0, 5).join(", ")}`);
    }
  } catch (error) {
    utils.build.failPlugin(`Privatus Analytics could not add the script: ${error instanceof Error ? error.message : String(error)}`);
  }
};
