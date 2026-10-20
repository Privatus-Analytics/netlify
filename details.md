# Privatus Analytics

Add [Privatus Analytics](https://privatusanalytics.com), cookieless web analytics, to a Netlify project without touching its code. After each build the extension puts the Privatus Analytics tracking script in the head of your project's HTML pages.

The script sets no cookies and uses no local storage, so there is no cookie banner to add. It is the only way data reaches Privatus Analytics. The extension itself sends nothing, reads no visitor data and calls no API while your site builds.

## How it works

1. You add your site ID to a project.
2. On every deploy, once the build is done, the extension finds the HTML files in your publish directory and adds this tag before `</head>`:

```html
<script defer src="https://privatusstats.com/js/pa.js" data-site="pa_YOURSITEID" data-modules="engage,auto,vitals,clicks,ask"></script>
```

3. Pages that already load the script are left alone, so builds are safe to repeat.

Your source files are never changed. Only the deployed copy of your pages gets the tag.

## Set it up

1. Create a site in Privatus Analytics and copy its site ID from Site settings, Tracking. It starts with `pa_`.
2. Install this extension on your team.
3. Open your project, then Project configuration, then Privatus Analytics. Paste the site ID and save.
4. Deploy. The deploy summary says how many pages got the script.
5. Back on the same page, choose Check the script to confirm the live home page loads it.

Prefer a file? Add this to `netlify.toml` instead and skip the screen:

```toml
[[integrations]]
  name = "privatus-analytics"
  [integrations.config]
    siteId = "pa_YOURSITEID"
```

Settings in `netlify.toml` win over the project screen, which wins over the team defaults.

## Options

| Option | Default | What it does |
|---|---|---|
| Tracker modules | All five | `engage` time on page and scroll depth, `auto` outbound links, downloads, forms and 404s, `vitals` Web Vitals, `clicks` click maps, `ask` on-site surveys. Automatic events count toward your event allowance. |
| Single-page app navigation | Auto | Follows route changes in single-page apps. |
| Pages never counted | None | Paths such as `/admin/*` that send nothing. |
| Count only on these hostnames | Every hostname | Stops counting on hostnames you do not list. |
| Leave these files without the script | None | Patterns for files in the published folder, such as `admin/**`. |
| Also track Deploy Previews | Off | Deploy Previews are not counted unless you turn this on. |
| Also track branch deploys | Off | The same for branch deploys. |

Production deploys are always tracked. Local builds and `netlify dev` are not.

## Limits

- Only HTML files in the published folder are changed. Pages that a function or an edge function renders on request, such as server-side rendering, are not. For those, use the Privatus Analytics package for your framework or add the tag to your layout.
- If your site sends a Content Security Policy, allow `https://privatusstats.com` in `script-src` and `connect-src`. See the tracker documentation.
- A page that already loads the script for a different site ID is left alone, and the deploy log says so.
- The extension does not delete or send anything. Remove the site ID, or turn off Add the script on deploys, and the next deploy goes out without the tag.

## Help

Documentation: https://privatusanalytics.com/docs/install. Questions: hello@privatusanalytics.com.
