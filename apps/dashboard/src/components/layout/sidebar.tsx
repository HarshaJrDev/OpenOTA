"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMe } from "@/features/auth/hooks";

import { NAV_ITEMS, type NavItem } from "./nav-items";

/** Every item a signed-in user can see — admin isn't in the static NAV_ITEMS list since it's
 * server-verified per-request regardless (see requireAdmin on every /admin/* route), but hiding
 * the link for non-admins avoids a confusing 401 for the vast majority of users who'll never have
 * access. Shared by the desktop sidebar and the mobile nav sheet so the two never drift apart. */
export function useNavItems(): NavItem[] {
  const { data: user } = useMe();
  return user?.isAdmin ? [...NAV_ITEMS, { title: "Admin", href: "/admin", icon: ShieldCheck, shortcut: "g m" }] : NAV_ITEMS;
}

/** The actual nav link list — rendered inside the desktop `<aside>` and inside the mobile
 * `<SheetContent>`. `onNavigate` closes the mobile sheet on link tap; desktop passes nothing. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = useNavItems();

  return (
    <nav className="flex-1 space-y-0.5 p-2">
      {items.map((item) => {
        const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
            )}
          >
            <span className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {item.title}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarBrand() {
  return (
    <div className="flex h-14 items-center gap-2 border-b px-4">
      <Image src="/icon.png" alt="" width={22} height={22} className="rounded-md" priority />
      <span className="font-semibold tracking-tight">OpenOTA</span>
    </div>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
      <SidebarBrand />
      <SidebarNav />
      <div className="border-t p-3 text-xs text-muted-foreground">
        <p>OpenOTA Dashboard v0.1.0</p>
      </div>
    </aside>
  );
}
