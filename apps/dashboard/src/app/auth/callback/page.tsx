"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

import { authKeys } from "@/features/auth/hooks";
import { setAuthToken } from "@/lib/auth-token";

/**
 * Landing page for the Google OAuth redirect (see apps/server's auth/routes.ts callback route).
 * The session token arrives as a URL *fragment* (`#token=...`), never a query string — fragments
 * are never sent to any server, including this page's own Next.js server, so this is the only
 * place the token is ever readable, and only by client-side JS. Mirrors exactly what
 * features/auth/api.ts's signup()/login() already do after a successful password auth.
 */
export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const hash = window.location.hash;
    const token = new URLSearchParams(hash.replace(/^#/, "")).get("token");

    if (!token) {
      setFailed(true);
      return;
    }

    setAuthToken(token);
    void queryClient.invalidateQueries({ queryKey: authKeys.me });
    router.replace("/projects");
  }, [queryClient, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{failed ? "Sign-in failed" : "Signing you in…"}</CardTitle>
          <CardDescription>
            {failed
              ? "Something went wrong completing Google sign-in. Try again from the login page."
              : "Just a moment."}
          </CardDescription>
        </CardHeader>
        {failed && (
          <CardContent>
            <a href="/login" className="text-sm text-muted-foreground hover:underline">
              Back to login
            </a>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
