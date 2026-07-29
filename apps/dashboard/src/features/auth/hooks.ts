import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";

import * as authApi from "./api";

export const authKeys = { me: ["auth", "me"] as const };

/** `retry: false` — a 401 here just means "not logged in", never worth retrying. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });
}

export function useSignup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.signup(email, password),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => authApi.login(email, password),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: authKeys.me }),
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => queryClient.clear(),
  });
}

export function authErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong";
}
