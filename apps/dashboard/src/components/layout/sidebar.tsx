"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Radio, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { useMe } from "@/features/auth/hooks";

import { NAV_ITEMS, type NavItem } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();
  const { data: user } = useMe();

  // Admin isn't in the static NAV_ITEMS list — it's server-verified per-request regardless (see
  // requireAdmin on every /admin/* route), but hiding the link for non-admins avoids a confusing
  // 401 for the vast majority of users who'll never have access.
  const items: NavItem[] = user?.isAdmin
    ? [...NAV_ITEMS, { title: "Admin", href: "/admin", icon: ShieldCheck, shortcut: "g m" }]
    : NAV_ITEMS;

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-background md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Radio className="h-5 w-5 text-primary" />
        <span className="font-semibold tracking-tight">OpenOTA</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-2">
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
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

      <div className="border-t p-3 text-xs text-muted-foreground">
        <p>OpenOTA Dashboard v0.1.0</p>
      </div>
    </aside>
  );
}
