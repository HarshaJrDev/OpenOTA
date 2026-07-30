import { apiRequest } from "@/lib/api-client";
import { setAuthToken } from "@/lib/auth-token";

export interface AuthUser {
  userId: string;
  email: string;
}

interface AuthResult {
  userId: string;
  token: string;
}

export async function signup(email: string, password: string): Promise<AuthResult> {
  const result = await apiRequest<AuthResult>("/auth/signup", { method: "POST", body: { email, password } });
  setAuthToken(result.token); // stored + sent as Bearer on every subsequent request
  return result;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const result = await apiRequest<AuthResult>("/auth/login", { method: "POST", body: { email, password } });
  setAuthToken(result.token);
  return result;
}

export async function logout(): Promise<{ loggedOut: boolean }> {
  try {
    return await apiRequest("/auth/logout", { method: "POST" });
  } finally {
    // Clear the local token regardless of whether the server call succeeds — the user intends to
    // be logged out either way, and a stale token must not linger.
    setAuthToken(null);
  }
}

export function me(): Promise<AuthUser> {
  return apiRequest("/auth/me");
}
