"use client";

import { MailWarning } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@openota/ui/button";

import { useResendVerificationEmail } from "@/features/auth/hooks";

export function VerifyEmailBanner({ email }: { email: string }) {
  const resend = useResendVerificationEmail();

  return (
    <div className="flex items-center justify-between gap-4 border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <MailWarning className="h-4 w-4 shrink-0" />
        <span>
          Verify <span className="font-medium">{email}</span> to secure your account.
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 border-amber-300 bg-transparent text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-900"
        disabled={resend.isPending}
        onClick={() =>
          resend.mutate(undefined, {
            onSuccess: () => toast.success("Verification email sent"),
            onError: () => toast.error("Failed to send verification email"),
          })
        }
      >
        {resend.isPending ? "Sending…" : "Resend email"}
      </Button>
    </div>
  );
}
