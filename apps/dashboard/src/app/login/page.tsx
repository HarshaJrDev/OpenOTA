"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";

import { authErrorMessage, useLogin, useSignup } from "@/features/auth/hooks";
import { getEffectiveServerUrl } from "@/lib/api-client";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up on this server yet.",
  google_auth_failed: "Google sign-in didn't complete. Please try again.",
};

export default function LoginPage() {
  return (
    <React.Suspense fallback={null}>
      <LoginForm />
    </React.Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const googleError = useSearchParams().get("error");
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === "login" ? login : signup;
  const [showColdStartHint, setShowColdStartHint] = React.useState(false);

  React.useEffect(() => {
    if (!mutation.isPending) {
      setShowColdStartHint(false);
      return;
    }
    // The default server is a free-tier Render instance that can take 30-60s to wake from cold —
    // show a hint after a few seconds so a slow first request doesn't look like a hang.
    const timer = setTimeout(() => setShowColdStartHint(true), 4000);
    return () => clearTimeout(timer);
  }, [mutation.isPending]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ email, password });
      router.push("/projects");
    } catch {
      // error is already surfaced via mutation.error below
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Log in to OpenOTA" : "Create your OpenOTA account"}</CardTitle>
          <CardDescription>
            {mode === "login" ? "Manage your projects and OTA releases." : "Start shipping OTA updates in minutes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {googleError && (
            <p className="mb-4 text-sm text-destructive">
              {GOOGLE_ERROR_MESSAGES[googleError] ?? "Something went wrong signing in with Google."}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = `${getEffectiveServerUrl()}/auth/google`;
            }}
          >
            Continue with Google
          </Button>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

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
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {mutation.isError && <p className="text-sm text-destructive">{authErrorMessage(mutation.error)}</p>}
            {showColdStartHint && (
              <p className="text-sm text-muted-foreground">
                Still working — the server may be waking up from sleep, this can take up to a minute.
              </p>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </Button>
          </form>

          {mode === "login" && (
            <Link href="/forgot-password" className="mt-3 block text-center text-sm text-muted-foreground hover:underline">
              Forgot password?
            </Link>
          )}

          <button
            type="button"
            className="mt-2 w-full text-center text-sm text-muted-foreground hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
