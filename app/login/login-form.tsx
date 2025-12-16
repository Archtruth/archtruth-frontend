"use client";

import * as React from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LoginFormProps = {
  variant?: "page" | "embedded";
  error?: string | null;
};

export function LoginForm({ variant = "page", error }: LoginFormProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [isSigningIn, setIsSigningIn] = React.useState(false);
  const [clientError, setClientError] = React.useState<string | null>(null);

  async function handleSignIn() {
    if (isSigningIn) return;
    setClientError(null);
    setIsSigningIn(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      console.error("Sign-in error:", error.message);
      setClientError(error.message);
      setIsSigningIn(false);
    }
  }

  const content = (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Welcome to ArchTruth</CardTitle>
        <CardDescription>Sign in with GitHub to continue.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error || clientError ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error || clientError}
          </div>
        ) : null}
        <Button className="w-full" type="button" onClick={handleSignIn} loading={isSigningIn}>
          {isSigningIn ? "Signing in…" : "Continue with GitHub"}
        </Button>
      </CardContent>
    </Card>
  );

  if (variant === "embedded") {
    return content;
  }

  return <div className="flex min-h-screen items-center justify-center bg-muted px-4">{content}</div>;
}
