"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { CommandPalette } from "@/components/layout/command-palette";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { VerifyEmailBanner } from "@/components/layout/verify-email-banner";
import { useMe } from "@/features/auth/hooks";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isError } = useMe();

  React.useEffect(() => {
    if (!isLoading && isError) {
      router.replace("/login");
    }
  }, [isLoading, isError, router]);

  if (isLoading || !user) {
    // Deliberately no spinner/flash-of-content here — redirecting on 401 happens in the effect
    // above, so a brief blank frame beats rendering the authenticated shell before we know.
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        {/* Test mode means no real email will ever arrive, so nagging to check an inbox that
            can't receive anything would just be confusing — see the admin settings toggle. */}
        {!user.emailVerified && !user.emailTestMode && <VerifyEmailBanner email={user.email} />}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
