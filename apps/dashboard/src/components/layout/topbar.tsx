"use client";

import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

import { Button } from "@openota/ui/button";

import { useLogout } from "@/features/auth/hooks";

import { MobileNav } from "./mobile-nav";
import { ProjectSwitcher } from "./project-switcher";
import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const router = useRouter();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:gap-4 sm:px-4">
      {/* min-w-0 is load-bearing: without it, a flex child's default min-width:auto lets its
          content (the search button below) refuse to shrink past its own intrinsic width,
          silently overflowing the header on a narrow phone instead of actually respecting the
          `flex-1` it's given. */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <MobileNav />
        <ProjectSwitcher />
        <Button
          variant="outline"
          className="min-w-0 flex-1 justify-start text-muted-foreground sm:max-w-sm md:w-64 md:flex-none"
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        >
          <Search className="h-4 w-4 sm:mr-2" />
          <span className="hidden truncate sm:inline">Search…</span>
          <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline-block">
            ⌘K
          </kbd>
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={logout.isPending} title="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
