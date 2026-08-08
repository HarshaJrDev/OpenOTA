"use client";

import * as React from "react";
import { Eye, ShieldAlert, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Label } from "@openota/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@openota/ui/select";
import { Skeleton } from "@openota/ui/skeleton";
import { Switch } from "@openota/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@openota/ui/tabs";

import { EmptyState } from "@/components/empty-state";
import { StatCard } from "@/components/stat-card";
import type { TrafficApp, TrafficRange } from "@/features/admin/api";
import { useAdminSettings, useTraffic, useUpdateAdminSettings } from "@/features/admin/hooks";
import { useMe } from "@/features/auth/hooks";

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

      <TrafficPanel />
    </div>
  );
}

function TrafficPanel() {
  const [app, setApp] = React.useState<TrafficApp>("docs");
  const [range, setRange] = React.useState<TrafficRange>("30d");
  const { data, isLoading } = useTraffic(app, range);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Traffic</h2>
          <p className="text-sm text-muted-foreground">
            Real pageviews recorded by the {app === "docs" ? "openota.xyz marketing site" : "dashboard itself"} —
            no third-party analytics, nothing sampled or estimated.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={app} onValueChange={(v) => setApp(v as TrafficApp)}>
            <TabsList>
              <TabsTrigger value="docs">Website</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={range} onValueChange={(v) => setRange(v as TrafficRange)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 days</SelectItem>
              <SelectItem value="30d">30 days</SelectItem>
              <SelectItem value="90d">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Pageviews" icon={Eye} value={(data?.views ?? 0).toString()} loading={isLoading} />
        <StatCard title="Unique visitors" icon={Users} value={(data?.uniqueVisitors ?? 0).toString()} loading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily pageviews</CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          {isLoading ? (
            <Skeleton className="h-full w-full" />
          ) : !data?.daily.length ? (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No visits recorded in this range yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} className="text-xs" />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="views" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top pages</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : !data?.topPaths.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No visits recorded in this range yet.</p>
          ) : (
            <div className="space-y-2">
              {data.topPaths.map((p) => (
                <div key={p.path} className="flex items-center justify-between border-b py-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs text-muted-foreground">{p.path}</span>
                  <span className="font-medium">{p.views}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
