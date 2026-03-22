"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Book, Github, Loader2 } from "lucide-react";

type LoginFormProps = {
  variant?: "page" | "embedded";
  error?: string | null;
  /** Non-error info (e.g. after account deletion). */
  notice?: string | null;
  onSignIn?: () => void;
};

export function LoginForm({ variant = "page", error, notice, onSignIn }: LoginFormProps) {
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
    <div className="w-full max-w-sm space-y-6 text-center">
      <div className="flex justify-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Book className="h-5 w-5" />
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">Sign in to your workspace</h2>
      </div>
      {notice && (
        <div className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}
      <Button
        className="w-full h-11 gap-2"
        type="button"
        onClick={handleSignIn}
        disabled={isSigningIn}
      >
        {isSigningIn ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Github className="h-4 w-4" />
        )}
        {isSigningIn ? "Signing in…" : "Continue with GitHub"}
      </Button>
    </div>
  );

  if (variant === "page") {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4">{content}</div>;
  }

  return content;
}
