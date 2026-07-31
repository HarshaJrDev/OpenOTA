"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";

import { authErrorMessage, useResetPassword } from "@/features/auth/hooks";

export default function ResetPasswordPage() {
  return (
    <React.Suspense fallback={null}>
      <ResetPasswordForm />
    </React.Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const router = useRouter();
  const [password, setPassword] = React.useState("");
  const resetPassword = useResetPassword();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;
    await resetPassword.mutateAsync({ token, password }).catch(() => undefined);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a new password for your OpenOTA account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-sm text-destructive">
              This link is missing its token. Request a new one from the{" "}
              <Link href="/forgot-password" className="underline">
                forgot password
              </Link>{" "}
              page.
            </p>
          ) : resetPassword.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Your password has been reset.</p>
              <Button className="w-full" onClick={() => router.push("/login")}>
                Log in
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>

              {resetPassword.isError && (
                <p className="text-sm text-destructive">{authErrorMessage(resetPassword.error)}</p>
              )}

              <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
                {resetPassword.isPending ? "Resetting…" : "Reset password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
