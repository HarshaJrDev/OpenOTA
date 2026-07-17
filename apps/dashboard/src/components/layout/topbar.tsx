"use client";

import { Search } from "lucide-react";

import { Button } from "@openota/ui/button";

import { ThemeToggle } from "./theme-toggle";

export function Topbar() {
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

      <ThemeToggle />
    </header>
  );
}
