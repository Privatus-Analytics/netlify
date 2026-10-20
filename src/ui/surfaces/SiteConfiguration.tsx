import { useState } from "react";
import { Alert, Button, Card, CardLoader, CardTitle, Checkbox, Form, FormField, SiteConfigurationSurface } from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc.js";
import { SettingsFields } from "../SettingsFields.jsx";
import { FormSchema, fromFormValues, toFormValues, type FormValues } from "../../lib/form.js";
import { SiteConfigSchema } from "../../lib/settings.js";

const Verify = () => {
  const check = trpc.verify.check.useMutation();
  const result = check.data;
  return (
    <Card>
      <CardTitle>Check the live site</CardTitle>
      <p className="tw-mb-4">
        Deploy the project, then check that the published home page loads the script. This reads one public page and sends nothing to
        Privatus Analytics.
      </p>
      <Button loading={check.isPending} onClick={() => check.mutate()}>
        Check the script
      </Button>
      {result?.status === "found" && result.matches && <Alert type="success">The script is on the page with your site ID.</Alert>}
      {result?.status === "found" && !result.matches && (
        <Alert type="warn">The script is on the page, but with the site ID {result.siteId ?? "(not readable)"}. Check that it is the one you saved.</Alert>
      )}
      {result?.status === "not-found" && (
        <Alert type="warn">The script was not found on the home page. Deploy again, and check that the deploy context is tracked.</Alert>
      )}
      {result?.status === "unreachable" && <Alert type="error">{result.message}</Alert>}
    </Card>
  );
};

export const SiteConfiguration = () => {
  const utils = trpc.useUtils();
  const settings = trpc.siteSettings.query.useQuery();
  const save = trpc.siteSettings.mutate.useMutation({ onSuccess: () => utils.siteSettings.query.invalidate() });
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  if (settings.isLoading) return <CardLoader />;

  const onSubmit = async (values: FormValues) => {
    const parsed = SiteConfigSchema.safeParse(fromFormValues(values));
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues.map((issue) => issue.message).join(" ") });
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      setMessage({ kind: "success", text: "Saved. The script is added to the pages of the next deploy." });
    } catch {
      setMessage({ kind: "error", text: "The settings could not be saved. Try again." });
    }
  };

  return (
    <SiteConfigurationSurface>
      <Card>
        <CardTitle>Privatus Analytics</CardTitle>
        <p className="tw-mb-4">
          Add your site ID and the extension puts the cookieless tracking script in the head of every page at the end of each build.
          Find the ID in Privatus Analytics under Site settings, Tracking. It starts with pa_.
        </p>
        {message && <Alert type={message.kind}>{message.text}</Alert>}
        <Form schema={FormSchema} defaultValues={toFormValues(settings.data)} onSubmit={onSubmit} submitButtonLabel="Save">
          <Checkbox name="enabled" label="Add the script on deploys" />
          <FormField name="siteId" label="Site ID" placeholder="pa_7Q2K9XH3AB" required helpText="Not a secret. It is visible in the page source." />
          <SettingsFields />
        </Form>
      </Card>
      {settings.data?.siteId && <Verify />}
    </SiteConfigurationSurface>
  );
};
