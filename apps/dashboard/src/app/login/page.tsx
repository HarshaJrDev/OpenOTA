"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@openota/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@openota/ui/card";
import { Input } from "@openota/ui/input";
import { Label } from "@openota/ui/label";

import { authErrorMessage, useLogin, useSignup } from "@/features/auth/hooks";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<"login" | "signup">("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const login = useLogin();
  const signup = useSignup();
  const mutation = mode === "login" ? login : signup;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await mutation.mutateAsync({ email, password });
      router.push("/projects");
    } catch {
      // error is already surfaced via mutation.error below
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === "login" ? "Log in to OpenOTA" : "Create your OpenOTA account"}</CardTitle>
          <CardDescription>
            {mode === "login" ? "Manage your projects and OTA releases." : "Start shipping OTA updates in minutes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {mutation.isError && <p className="text-sm text-destructive">{authErrorMessage(mutation.error)}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </Button>
          </form>

          <button
            type="button"
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
