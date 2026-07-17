import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

import { ServerUrlForm } from "@/features/settings/server-url-form";

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Storage, branding, runtime, and release channel configuration.</p>
      </div>

      <ServerUrlForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>Custom logo, colors, and white-label domains for this dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not implemented — tracked under &quot;Future Ready&quot; alongside multi-tenancy and white-labeling.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Runtime</CardTitle>
          <CardDescription>Default runtime version compatibility policy enforced at upload time.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Runtime version compatibility is enforced today by the native Android runtime at activation time (exact
            match between manifest and app binary). Server-side policy configuration (e.g. semver ranges) isn&apos;t
            implemented yet.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Release Channels</CardTitle>
          <CardDescription>Route different builds (production/beta/staging) to different device cohorts.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Not implemented server-side yet — see the Channels page for what exists today (a per-platform active-version
            pointer, not named channels).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
