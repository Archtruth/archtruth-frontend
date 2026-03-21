"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type LoginFormProps = {
  variant?: "page" | "embedded";
  error?: string | null;
  /** Optional override: called instead of the default window.location.href navigation. */
  onSignIn?: () => void;
};

export function LoginForm({ variant = "page", error, onSignIn }: LoginFormProps) {
  const [isSigningIn, setIsSigningIn] = React.useState(false);

  function handleSignIn() {
    if (isSigningIn) return;
    if (onSignIn) {
      onSignIn();
      return;
    }
    setIsSigningIn(true);
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
