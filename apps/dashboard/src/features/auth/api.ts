import { apiRequest } from "@/lib/api-client";

export interface AuthUser {
  userId: string;
  email: string;
}

export function signup(email: string, password: string): Promise<{ userId: string }> {
  return apiRequest("/auth/signup", { method: "POST", body: { email, password } });
}

export function login(email: string, password: string): Promise<{ userId: string }> {
  return apiRequest("/auth/login", { method: "POST", body: { email, password } });
}

export function logout(): Promise<{ loggedOut: boolean }> {
  return apiRequest("/auth/logout", { method: "POST" });
}

export function me(): Promise<AuthUser> {
  return apiRequest("/auth/me");
}
