"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  async function handleSignIn() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${siteUrl}/auth/callback`,
      },
    });
    if (error) {
      console.error("Sign-in error:", error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to ArchTruth</CardTitle>
          <CardDescription>Sign in with GitHub to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" type="button" onClick={handleSignIn}>
            Continue with GitHub
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
