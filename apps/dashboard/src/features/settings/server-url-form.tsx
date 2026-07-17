"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";

import { getServerUrlOverride, setServerUrlOverride } from "@/lib/server-config";

const schema = z.object({
  serverUrl: z.string().url("Must be a valid URL, e.g. http://localhost:3001/api/v1"),
});

type FormValues = z.infer<typeof schema>;

export function ServerUrlForm() {
  const [currentDefault, setCurrentDefault] = React.useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { serverUrl: "" },
  });

  React.useEffect(() => {
    const override = getServerUrlOverride();
    const fallback = process.env.NEXT_PUBLIC_OPENOTA_SERVER_URL ?? "";
    setCurrentDefault(fallback);
    form.reset({ serverUrl: override ?? fallback });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = (values: FormValues) => {
    setServerUrlOverride(values.serverUrl);
    toast.success("Server URL updated. Reloading data…");
    window.location.reload();
  };

  const onReset = () => {
    setServerUrlOverride(null);
    form.reset({ serverUrl: currentDefault });
    toast.success(`Reset to default (${currentDefault || "unset"})`);
  };

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <CardHeader>
          <CardTitle className="text-base">Storage / Server</CardTitle>
          <CardDescription>
            The OpenOTA server this dashboard talks to. Overriding it here only changes this browser — it never touches
            the server&apos;s own storage config.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="serverUrl">Server URL</Label>
          <Input id="serverUrl" placeholder="http://localhost:3001/api/v1" {...form.register("serverUrl")} />
          {form.formState.errors.serverUrl ? (
            <p className="text-sm text-destructive">{form.formState.errors.serverUrl.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Default: {currentDefault || "not configured"}</p>
          )}
        </CardContent>
        <CardFooter className="gap-2">
          <Button type="submit">Save</Button>
          <Button type="button" variant="outline" onClick={onReset}>
            Reset to default
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
