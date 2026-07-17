import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@openota/ui/card";
import { Skeleton } from "@openota/ui/skeleton";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value?: string;
  icon: LucideIcon;
  hint?: string;
  loading?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
  accent?: "default" | "success" | "warning" | "destructive";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  destructive: "text-red-600 dark:text-red-400",
};

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  loading,
  unavailable,
  unavailableReason,
  accent = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : unavailable ? (
          <>
            <p className="text-2xl font-semibold text-muted-foreground">—</p>
            <p className="mt-1 text-xs text-muted-foreground">{unavailableReason ?? "Not tracked yet"}</p>
          </>
        ) : (
          <>
            <p className={cn("text-2xl font-semibold", ACCENT_CLASSES[accent])}>{value}</p>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
