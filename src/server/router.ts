import { TRPCError } from "@trpc/server";
import { procedure, router } from "./trpc.js";
import { SiteConfigSchema, TeamConfigSchema } from "../lib/settings.js";
import { verifyPublishedPage } from "../lib/verify.js";

const need = (value: string | null, name: string): string => {
  if (!value) throw new TRPCError({ code: "BAD_REQUEST", message: `${name} is required` });
  return value;
};

/** The address a project is published at: its custom domain, else its Netlify address. */
const publishedUrl = (site: { ssl_url?: string; url?: string; custom_domain?: string }): string | undefined =>
  site.custom_domain ? `https://${site.custom_domain}` : (site.ssl_url ?? site.url);

export const appRouter = router({
  teamSettings: {
    query: procedure.query(async ({ ctx: { teamId, client } }) => {
      const config = await client.getTeamConfiguration(need(teamId, "teamId"));
      if (!config) return null;
      const parsed = TeamConfigSchema.safeParse(config.config);
      return parsed.success ? parsed.data : null;
    }),

    mutate: procedure.input(TeamConfigSchema).mutation(async ({ ctx: { teamId, client }, input }) => {
      try {
        await client.upsertTeamConfiguration(need(teamId, "teamId"), input);
      } catch (cause) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The team defaults could not be saved.", cause });
      }
    }),
  },

  siteSettings: {
    query: procedure.query(async ({ ctx: { teamId, siteId, client } }) => {
      const config = await client.getSiteConfiguration(need(teamId, "teamId"), need(siteId, "siteId"));
      if (!config) return null;
      const parsed = SiteConfigSchema.safeParse(config.config);
      return parsed.success ? parsed.data : null;
    }),

    mutate: procedure.input(SiteConfigSchema).mutation(async ({ ctx: { teamId, siteId, client }, input }) => {
      try {
        await client.upsertSiteConfiguration(need(teamId, "teamId"), need(siteId, "siteId"), input);
      } catch (cause) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The project settings could not be saved.", cause });
      }
    }),
  },

  /** Looks for the script on the published home page. Reads one public page and nothing else. */
  verify: {
    check: procedure.mutation(async ({ ctx: { teamId, siteId, client } }) => {
      const config = await client.getSiteConfiguration(need(teamId, "teamId"), need(siteId, "siteId"));
      const parsed = SiteConfigSchema.safeParse(config?.config);
      if (!parsed.success) return { status: "unreachable" as const, message: "Save a site ID first." };
      const site = (await client.getSite(need(siteId, "siteId"))) as unknown as { ssl_url?: string; url?: string; custom_domain?: string };
      const url = publishedUrl(site);
      if (!url) return { status: "unreachable" as const, message: "This project has not been published yet." };
      return { url, ...(await verifyPublishedPage(url, parsed.data.siteId)) };
    }),
  },
});

export type AppRouter = typeof appRouter;
