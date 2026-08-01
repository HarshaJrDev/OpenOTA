"use client";

import { ShieldAlert } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Label } from "@openota/ui/label";
import { Skeleton } from "@openota/ui/skeleton";
import { Switch } from "@openota/ui/switch";

import { EmptyState } from "@/components/empty-state";
import { useMe } from "@/features/auth/hooks";
import { useAdminSettings, useUpdateAdminSettings } from "@/features/admin/hooks";

export default function AdminPage() {
  const { data: user, isLoading: meLoading } = useMe();

  if (meLoading) {
    return <Skeleton className="h-40 w-full max-w-2xl" />;
  }

  // Defense in depth: the sidebar already hides this link for non-admins, but every /admin/*
  // server route re-checks ADMIN_EMAILS independently regardless of what the client believes —
  // this client-side gate is only about not showing a confusing 401-driven error state.
  if (!user?.isAdmin) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Admin access required"
        description="This account is not listed in the server's ADMIN_EMAILS configuration."
      />
    );
  }

  return <AdminSettingsPanel />;
}

function AdminSettingsPanel() {
  const { data: settings, isLoading } = useAdminSettings();
  const updateSettings = useUpdateAdminSettings();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Server-wide settings. Changes apply immediately, no redeploy needed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email delivery</CardTitle>
          <CardDescription>
            Controls whether verification and password-reset emails are actually sent via Resend, or just logged to the
            server console. Defaults to ON so a fresh deployment never emails real users by accident — turn it off once
            you&apos;re ready to send real email (also requires <code className="font-mono">RESEND_API_KEY</code> and a
            verified <code className="font-mono">EMAIL_FROM</code> domain to be configured on the server).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-full" />
          ) : (
            <div className="flex items-center justify-between rounded-md border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="email-test-mode" className="text-sm font-medium">
                  Test mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  {settings?.emailTestMode
                    ? "ON — emails are logged only, nothing is sent to real inboxes."
                    : "OFF — emails are sent for real via Resend."}
                </p>
              </div>
              <Switch
                id="email-test-mode"
                checked={settings?.emailTestMode ?? true}
                disabled={updateSettings.isPending}
                onCheckedChange={(checked) => updateSettings.mutate({ emailTestMode: checked })}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
