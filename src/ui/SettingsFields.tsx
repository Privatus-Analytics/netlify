import { Checkbox, FormField, Select } from "@netlify/sdk/ui/react/components";
import { MODULES, MODULE_LABELS } from "../lib/settings.js";

/** The options both forms share. The project form adds the site ID above them. */
export const SettingsFields = () => (
  <>
    <fieldset className="tw-flex tw-flex-col tw-gap-2">
      <legend className="tw-mb-1 tw-font-semibold">Tracker modules</legend>
      {MODULES.map((name) => (
        <Checkbox key={name} name={name} label={MODULE_LABELS[name]} />
      ))}
      <p className="tw-text-sm">
        The basic script counts pageviews. Time on page and scroll depth need the first module. Automatic events count toward your event
        allowance.
      </p>
    </fieldset>

    <Select
      name="spa"
      label="Single-page app navigation"
      helpText="Auto follows route changes in single-page apps. Use Off for a site where every page is a full page load and you want the plainest script."
      options={[
        { label: "Auto", value: "auto" },
        { label: "History API only", value: "history" },
        { label: "Hash changes only", value: "hash" },
        { label: "Off", value: "off" },
      ]}
    />

    <FormField
      type="textarea"
      name="exclude"
      label="Pages never counted"
      helpText="One path pattern per line, such as /admin/*. A matching page sends nothing."
    />
    <FormField
      type="textarea"
      name="domains"
      label="Count only on these hostnames"
      helpText="One hostname per line, such as www.example.com. Leave empty to count on every hostname the project is served from."
    />
    <FormField
      type="textarea"
      name="skipFiles"
      label="Leave these files without the script"
      helpText="One pattern per line, matched against paths in the published folder, such as admin/** or drafts/*.html."
    />
    <Checkbox name="trackPreviews" label="Also track Deploy Previews" />
    <Checkbox name="trackBranchDeploys" label="Also track branch deploys" />
  </>
);
