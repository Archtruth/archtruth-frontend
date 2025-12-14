import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function signInWithGithub() {
  "use server";
  const supabase = getSupabaseServerClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });
  if (error || !data?.url) {
    throw new Error(error?.message || "Unable to start GitHub sign-in");
  }
  redirect(data.url);
}

export default async function LoginPage() {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  if (data.session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to ArchTruth</CardTitle>
          <CardDescription>Sign in with GitHub to continue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={signInWithGithub} className="space-y-3">
            <Button className="w-full" type="submit">
              Continue with GitHub
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
