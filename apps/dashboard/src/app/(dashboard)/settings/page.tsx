import { FlaskConical } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

import { SdkConfigCard } from "@/features/settings/sdk-config-card";
import { ServerUrlForm } from "@/features/settings/server-url-form";

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="max-w-2xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Storage, branding, runtime, and release channel configuration.</p>
      </div>

      <SettingsSection title="General">
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
      </SettingsSection>

      <SettingsSection title="React Native">
        <SdkConfigCard />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
              Reference app
            </CardTitle>
            <CardDescription>
              OpenOTA_Example in the monorepo — a real, working OTA client, not a mock. Every screen talks to the
              live OpenOTA API through the real, published @openota/sdk and @openota/native-android packages.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Worth reading: <code className="rounded bg-muted px-1 py-0.5 text-xs">src/context/OtaContext.tsx</code>{" "}
            for the whole integration surface, and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">android/app/.../MainApplication.kt</code> for the
            required native wiring.{" "}
            <a
              href="https://docs.openota.xyz/docs#reference-app"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Full walkthrough in the docs →
            </a>
          </CardContent>
        </Card>
      </SettingsSection>

      <SettingsSection title="OTA">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime version policy</CardTitle>
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
            <CardTitle className="text-base">Release channels</CardTitle>
            <CardDescription>Route different builds (production/beta/staging) to different device cohorts.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Named channels are managed on the{" "}
              <Link href="/environments" className="underline underline-offset-4 hover:text-foreground">
                Environments
              </Link>{" "}
              page — each environment (Production, Staging, …) maps to an independent per-platform active-version
              pointer.
            </p>
          </CardContent>
        </Card>
      </SettingsSection>

      <SettingsSection title="Security">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API keys</CardTitle>
            <CardDescription>Credentials for the CLI and CI — scoped per project, revocable, never re-shown.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Managed on the{" "}
              <Link href="/api-keys" className="underline underline-offset-4 hover:text-foreground">
                Connect
              </Link>{" "}
              page, alongside your project&apos;s Server URL and Project ID.
            </p>
          </CardContent>
        </Card>
      </SettingsSection>

      <SettingsSection title="Storage (advanced)">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Storage backend</CardTitle>
            <CardDescription>Where uploaded bundle bytes actually live.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configured server-side via the <code className="font-mono">STORAGE_PROVIDER</code> environment variable
              (<code className="font-mono">local</code> or <code className="font-mono">supabase</code>) — not
              switchable from the dashboard, since changing it doesn&apos;t migrate already-uploaded bundles.
            </p>
          </CardContent>
        </Card>
      </SettingsSection>
    </div>
  );
}
