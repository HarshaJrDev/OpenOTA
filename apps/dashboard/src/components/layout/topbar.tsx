"use client";

import { useRouter } from "next/navigation";
import { LogOut, Search } from "lucide-react";

import { Button } from "@openota/ui/button";

import { useLogout } from "@/features/auth/hooks";

import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
  const router = useRouter();
  const logout = useLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-background px-4">
      <Button
        variant="outline"
        className="w-full max-w-sm justify-start text-muted-foreground md:w-64"
        onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
      >
        <Search className="mr-2 h-4 w-4" />
        Search…
        <kbd className="ml-auto rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </Button>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={handleLogout} disabled={logout.isPending} title="Log out">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
