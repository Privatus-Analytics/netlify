import { useState } from "react";
import { Alert, Card, CardLoader, CardTitle, Form, TeamConfigurationSurface } from "@netlify/sdk/ui/react/components";
import { trpc } from "../trpc.js";
import { SettingsFields } from "../SettingsFields.jsx";
import { FormSchema, fromFormValues, toFormValues, type FormValues } from "../../lib/form.js";
import { TeamConfigSchema } from "../../lib/settings.js";

export const TeamConfiguration = () => {
  const utils = trpc.useUtils();
  const settings = trpc.teamSettings.query.useQuery();
  const save = trpc.teamSettings.mutate.useMutation({ onSuccess: () => utils.teamSettings.query.invalidate() });
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  if (settings.isLoading) return <CardLoader />;

  const onSubmit = async (values: FormValues) => {
    const { enabled: _enabled, siteId: _siteId, ...raw } = fromFormValues(values);
    const parsed = TeamConfigSchema.safeParse(raw);
    if (!parsed.success) {
      setMessage({ kind: "error", text: parsed.error.issues.map((issue) => issue.message).join(" ") });
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      setMessage({ kind: "success", text: "The defaults are saved. They apply to the next deploy of every project that has a site ID." });
    } catch {
      setMessage({ kind: "error", text: "The defaults could not be saved. Try again." });
    }
  };

  return (
    <TeamConfigurationSurface>
      <Card>
        <CardTitle>Defaults for every project</CardTitle>
        <p className="tw-mb-4">
          The extension adds the Privatus Analytics tracking script to a project only after you give that project a site ID, under
          Project configuration, Privatus Analytics. These defaults fill in everything else. A project can change any of them.
        </p>
        {message && <Alert type={message.kind}>{message.text}</Alert>}
        <Form schema={FormSchema} defaultValues={toFormValues(settings.data)} onSubmit={onSubmit} submitButtonLabel="Save defaults">
          <SettingsFields />
        </Form>
      </Card>
    </TeamConfigurationSurface>
  );
};
