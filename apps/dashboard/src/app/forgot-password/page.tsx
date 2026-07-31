"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";

import { authErrorMessage, useForgotPassword } from "@/features/auth/hooks";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const forgotPassword = useForgotPassword();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await forgotPassword.mutateAsync(email).catch(() => undefined);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>We&apos;ll email you a link to set a new password.</CardDescription>
        </CardHeader>
        <CardContent>
          {forgotPassword.isSuccess ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, a reset link
                is on its way. Check your inbox.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {forgotPassword.isError && (
                <p className="text-sm text-destructive">{authErrorMessage(forgotPassword.error)}</p>
              )}

              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "Sending…" : "Send reset link"}
              </Button>

              <Link href="/login" className="block text-center text-sm text-muted-foreground hover:underline">
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
