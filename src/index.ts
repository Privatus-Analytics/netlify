import { NetlifyExtension } from "@netlify/sdk";
import { runBuild } from "./lib/build.js";
import type { SiteConfig, TeamConfig } from "./lib/settings.js";

/**
 * Privatus Analytics for Netlify.
 *
 * After a project builds, and before it deploys, the tracking script is
 * added to the project's HTML files. The script is the only way events get
 * into Privatus Analytics: this extension sends nothing itself, reads no
 * visitor data and calls no Privatus Analytics API during a build.
 *
 * The handler runs for every project of a team that installs the extension,
 * so it stays silent and does nothing until a project has a site ID.
 */
// netlify.toml settings are passed on as they are. runBuild checks them and
// reports a mistake in the deploy summary instead of failing the build.
const extension = new NetlifyExtension<SiteConfig, TeamConfig>({
  parseBuildConfig: (config) => (config && typeof config === "object" ? (config as Record<string, unknown>) : {}),
});

extension.addBuildEventHandler("onPostBuild", ({ buildConfig, client, constants, utils }) =>
  runBuild({ client, buildConfig, constants, utils, env: process.env }),
);

export { extension };
