import { apiRequest } from "@/lib/api-client";
import { setAuthToken } from "@/lib/auth-token";

export interface AuthUser {
  userId: string;
  email: string;
  emailVerified: boolean;
  isAdmin: boolean;
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

export function resendVerificationEmail(): Promise<{ sent: boolean }> {
  return apiRequest("/auth/verify-email/resend", { method: "POST" });
}

export function confirmVerificationEmail(token: string): Promise<{ verified: boolean }> {
  return apiRequest("/auth/verify-email/confirm", { method: "POST", body: { token } });
}

export function forgotPassword(email: string): Promise<{ sent: boolean }> {
  return apiRequest("/auth/forgot-password", { method: "POST", body: { email } });
}

export function resetPassword(token: string, password: string): Promise<{ reset: boolean }> {
  return apiRequest("/auth/reset-password", { method: "POST", body: { token, password } });
}
