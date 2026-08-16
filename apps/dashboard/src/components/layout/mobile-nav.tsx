"use client";

import * as React from "react";
import { Menu } from "lucide-react";

import { Button } from "@openota/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@openota/ui/sheet";

import { SidebarBrand, SidebarNav } from "./sidebar";

/**
 * Below `md`, `Sidebar` (in sidebar.tsx) is `hidden` with nothing replacing it — every nav item
 * (Projects, Packages, Releases, Devices, Settings, everything) simply disappeared on a phone,
 * with no way back to any of them. This is the mobile-only replacement: a slide-in sheet sharing
 * the exact same `SidebarNav` link list, so desktop and mobile navigation can never drift apart.
 */
export function MobileNav() {
  const [open, setOpen] = React.useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SidebarBrand />
        <SidebarNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
