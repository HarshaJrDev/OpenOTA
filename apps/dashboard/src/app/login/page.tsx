"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

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
  const googleError = useSearchParams().get("error");
  const [redirecting, setRedirecting] = React.useState(false);

  function continueWithGoogle() {
    setRedirecting(true);
    window.location.href = `${getEffectiveServerUrl()}/auth/google`;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {/* Subtle radial glow behind the card — matches the marketing site's restrained, technical
          feel without importing its brand-gradient tokens (this app has its own neutral palette). */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/[0.06] blur-[100px]"
      />

      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/icon.png" alt="" width={40} height={40} className="rounded-xl shadow-sm" priority />
          <h1 className="mt-4 text-xl font-semibold tracking-tight">Sign in to OpenOTA</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Manage your projects and OTA releases.</p>
        </div>

        <Card className="border-border/60 shadow-lg shadow-black/[0.03]">
          <CardHeader className="sr-only">
            <CardTitle>Sign in to OpenOTA</CardTitle>
            <CardDescription>Continue with your Google account.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {googleError && (
              <p
                role="alert"
                className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {GOOGLE_ERROR_MESSAGES[googleError] ?? "Something went wrong signing in with Google."}
              </p>
            )}

            <button
              type="button"
              onClick={continueWithGoogle}
              disabled={redirecting}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card px-4 py-3 text-sm font-medium text-foreground outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-70"
            >
              {redirecting ? (
                <>
                  <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Redirecting to Google…
                </>
              ) : (
                <>
                  <GoogleLogo className="h-4 w-4 shrink-0" />
                  Continue with Google
                </>
              )}
            </button>

            <p className="mt-5 text-center text-xs leading-relaxed text-muted-foreground">
              No separate OpenOTA password to manage — your account is tied to your Google identity.
              By continuing, you agree to OpenOTA&apos;s{" "}
              <a
                href="https://openota.xyz/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms
              </a>{" "}
              and{" "}
              <a
                href="https://openota.xyz/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a href="https://openota.xyz" className="hover:text-foreground hover:underline">
            ← Back to openota.xyz
          </a>
        </p>
      </div>
    </div>
  );
}

/** Official Google "G" logomark, inline so the button never depends on an external icon request. */
function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24 24 0 0 0 0 21.56l7.98-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.9l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
