import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError } from "@/lib/api-client";

import * as adminApi from "./api";
import type { TrafficApp, TrafficRange } from "./api";

const adminKeys = { settings: ["admin", "settings"] as const };

export function useAdminSettings() {
  return useQuery({ queryKey: adminKeys.settings, queryFn: adminApi.getAdminSettings });
}

export function useTraffic(app: TrafficApp, range: TrafficRange) {
  return useQuery({
    queryKey: ["admin", "traffic", app, range],
    queryFn: () => adminApi.getTraffic(app, range),
    // Traffic changes continuously — a stale 5-minute-old count on an admin panel is misleading in
    // a way a stale package list isn't, so this refetches more eagerly than the query client's
    // global default.
    refetchInterval: 30_000,
  });
}

export function useUpdateAdminSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: adminApi.updateAdminSettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(adminKeys.settings, settings);
      toast.success(settings.emailTestMode ? "Email test mode enabled — emails will be logged, not sent." : "Email test mode disabled — real emails will now be sent via Resend.");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update settings");
    },
  });
}
