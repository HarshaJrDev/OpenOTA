"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";

import { authErrorMessage, useConfirmVerificationEmail } from "@/features/auth/hooks";

export default function VerifyEmailPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyEmailStatus />
    </React.Suspense>
  );
}

function VerifyEmailStatus() {
  const token = useSearchParams().get("token");
  const confirmVerification = useConfirmVerificationEmail();
  const attempted = React.useRef(false);

  React.useEffect(() => {
    if (!token || attempted.current) return;
    attempted.current = true;
    confirmVerification.mutate(token);
  }, [token, confirmVerification]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>Confirming your OpenOTA account email.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!token ? (
            <p className="text-sm text-destructive">This link is missing its token.</p>
          ) : confirmVerification.isPending ? (
            <p className="text-sm text-muted-foreground">Verifying…</p>
          ) : confirmVerification.isSuccess ? (
            <p className="text-sm text-muted-foreground">Your email is verified.</p>
          ) : confirmVerification.isError ? (
            <p className="text-sm text-destructive">{authErrorMessage(confirmVerification.error)}</p>
          ) : null}

          <Button asChild variant="outline" className="w-full">
            <Link href="/projects">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
