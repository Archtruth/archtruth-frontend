"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  variant?: "page" | "embedded";
  error?: string | null;
};

export function LoginForm({ variant = "page", error }: LoginFormProps) {
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  function handleSignIn() {
    if (isSigningIn) return;
    setIsSigningIn(true);
    // Navigate to the server-side OAuth initiation route.
    // This stores the PKCE code_verifier via a reliable Set-Cookie header
    // rather than the browser client's setItemAsync(), which has a known
    // intermittent bug where it silently fails to persist the cookie.
    // See: https://github.com/supabase/ssr/issues/55
    window.location.href = "/auth/login";
  }

  const content = (
    <div className="w-full max-w-md space-y-4">
      {error ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <Button className="w-full" type="button" onClick={handleSignIn} loading={isSigningIn}>
        {isSigningIn ? "Signing in…" : "Login/Signup with Github"}
      </Button>
    </div>
  );

  if (variant === "page") {
    return <div className="flex min-h-screen items-center justify-center bg-muted px-4">{content}</div>;
  }

  return content;
}
