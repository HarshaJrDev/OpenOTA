import {
  Activity,
  Boxes,
  FolderKanban,
  Gauge,
  KeyRound,
  Layers,
  ScrollText,
  Settings,
  Smartphone,
  Tags,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: typeof Gauge;
  shortcut: string;
}

export const NAV_ITEMS: NavItem[] = [
  { title: "Overview", href: "/", icon: Gauge, shortcut: "g o" },
  { title: "Projects", href: "/projects", icon: FolderKanban, shortcut: "g j" },
  { title: "Packages", href: "/packages", icon: Boxes, shortcut: "g p" },
  { title: "Environments", href: "/environments", icon: Layers, shortcut: "g e" },
  { title: "Releases", href: "/releases", icon: Tags, shortcut: "g r" },
  { title: "Devices", href: "/devices", icon: Smartphone, shortcut: "g d" },
  { title: "Analytics", href: "/analytics", icon: Activity, shortcut: "g a" },
  { title: "Logs", href: "/logs", icon: ScrollText, shortcut: "g l" },
  { title: "API Keys", href: "/api-keys", icon: KeyRound, shortcut: "g k" },
  { title: "Settings", href: "/settings", icon: Settings, shortcut: "g s" },
];
