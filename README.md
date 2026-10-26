# Privatus Analytics for Netlify

**Real visitor numbers for your Netlify site. No cookies, no cookie pop-up, no bots.**

You want to know if people visit your Netlify site. But Google Analytics uses
cookies, so in many countries you must show a cookie pop-up first (the box that
asks visitors to say yes to cookies). Many people click no, so they never show
up in your numbers. Bots add fake visits on top.

This Netlify extension adds the Privatus Analytics script to every page when
your site builds. Give your project its site id once, and every deploy has the
script. A failure never stops a deploy. The script sets no cookies and keeps no
IP addresses. Bots are filtered out before they are counted.

So you see how many real people came, which pages they looked at and where they
came from, on one simple dashboard. A report comes to your inbox each week, and
you can set alerts for when traffic jumps or drops. And you don't need a cookie
pop-up for your analytics.

**Free plan, no card:** 10,000 events a month (an event is a page view or an action you track) on up to 3 sites. [Start free at privatusanalytics.com](https://privatusanalytics.com).

- **No cookies.** No cookies and no hidden IDs on your visitors' devices, and no IP
  addresses are kept. Laws differ by country, so check your own legal advice.
- **Real people, not bots.** Known bots, data centers and spam visits are left
  out on every plan.
- **Small and fast.** The script is about 3 KB when compressed.

## About this repo

A [Netlify SDK](https://developers.netlify.com/sdk/) extension that adds the
[Privatus Analytics](https://privatusanalytics.com) tracking script to a project's pages at build
time. Install it on a team, give a project its site ID, and every deploy ships with the script.

The tracking script is the only way events get into Privatus Analytics, and this extension keeps to
that. It sends nothing itself, reads no visitor data, and calls no Privatus Analytics API while a
site builds. The one network call it can make is a button in the settings screen that loads the
project's own public home page to look for the script.

## What it does

- **Build event handler** (`onPostBuild`): finds the HTML files in the publish directory and adds
  `<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_..." data-modules="..."></script>`
  before `</head>`. A page that already loads the script is left alone, so builds are idempotent.
  Fragments with no head, pages for another site ID and files that are not UTF-8 are left alone and
  counted in the deploy summary. Symbolic links are never followed.
- **Settings screens** (extension UI):
  - Project configuration, Privatus Analytics: the site ID, an on and off switch, the tracker
    modules, SPA mode, pages never counted (`data-exclude`), hostnames to count on (`data-domains`),
    files to leave without the script, and Deploy Preview and branch deploy tracking. A Check the
    script button loads the published home page and reports whether the script is there and whether the
    site ID matches.
  - Extensions, Privatus Analytics, Configuration: team defaults for everything except the site ID.
- **`netlify.toml`** works instead of the screens: `[[integrations]]`, `name = "adwjt60k-privatus-analytics"`,
  `[integrations.config]` with `siteId` and the same options. It wins over the screens.
- **Contexts.** Production is always tracked. Deploy Previews and branch deploys only when turned on.
  Local builds and `netlify dev` are never tracked.
- **Silent by default.** The handler runs for every project on a team that installs the extension, so
  it returns at once, with no log line, until a project has a site ID.
- **A failure never stops a deploy.** Anything unexpected is reported as a plugin failure, not a
  build failure. A wrong setting is shown in the deploy summary.

Product rules kept: only the tracking script sends events, the brand is always "Privatus Analytics",
nothing deletes data, and the permission it asks for is `site: read` only.

## Layout

```
extension.yaml           slug, name, scopes, UI surfaces
details.md               the text Netlify shows on the extension page
netlify.toml             how the extension itself is built and hosted on Netlify
src/index.ts             the extension: registers the build event handler
src/lib/settings.ts      the settings, their limits, how team, project and netlify.toml combine
src/lib/snippet.ts       the script tag
src/lib/html.ts          where in a page the tag goes, and detecting an existing script
src/lib/inject.ts        walks the publish directory
src/lib/build.ts         what runs after a build (settings, context, injection, report)
src/lib/verify.ts        the Check the script button
src/lib/form.ts          settings forms to and from saved settings
src/server/router.ts     tRPC procedures behind the screens (save, load, check)
src/endpoints/trpc.ts    the function that serves them
src/ui/                  the React screens (Netlify SDK components)
test/                    vitest
assets/logo-512.png      the logo for the listing
```

## Develop

```sh
npm install --ignore-scripts --before=2026-10-06T00:00:00Z   # see "Dependencies"
npm test            # 62 unit tests, no network
npm run typecheck   # backend and UI
npm run build       # netlify-extension build: the handler, the UI and the endpoint, into .ntli/
npm run check       # all three
```

Testing in a real team needs a private extension, which needs a Netlify account: see
`SUBMISSION.md`. After that, `npm run dev:open` serves the screens locally inside the Netlify UI.

### What is verified offline

- 62 unit tests: settings merging and validation (team, project, `netlify.toml`, invalid values),
  the contexts, the exact script tag, HTML placement (minified pages, CRLF, comments and scripts
  containing `</head>`, a missing `</head>`, `<header>` is not `<head>`, idempotence, other site IDs),
  injection over a real temporary directory (nested pages, skip patterns, non-UTF-8 files, fragments,
  symbolic links, `node_modules`), the whole build handler with a fake client (silent when not set
  up, `netlify.toml` only, unreadable settings, previews, invalid settings, a crash becomes a plugin
  failure) and the Check the script logic with a mocked fetch.
- `tsc` for the backend and the UI with the real SDK types.
- `netlify-extension build` completes: the manifest reports a build event handler and both UI
  surfaces, the UI and the `trpc` endpoint bundle.

Not verifiable without a Netlify team: the screens inside the Netlify UI, the saved settings round
trip through Netlify's extension API, and a real deploy. The SDK types were read from the installed
packages, and the screens follow the SDK's own scaffold.

## Dependencies

Every dependency is pinned to an exact version at least two weeks old, and `package-lock.json` was
produced with `--before=2026-10-06`, which also holds back transitive packages published after that
date. Use the same flag when you update. `zod` is 3.x because the SDK's `Form` component takes zod 3
schemas. `netlify-cli` is a dev dependency because `netlify-extension build` needs it.
