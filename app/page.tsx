import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-muted">
      <header className="border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="text-lg font-semibold">ArchTruth</div>
          <Link href="/login">
            <Button size="sm">Sign in</Button>
          </Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14">
        <div className="max-w-3xl space-y-4">
          <h1 className="text-4xl font-semibold text-foreground">Ship documentation your repos deserve.</h1>
          <p className="text-lg text-mutedForeground">
            Connect your GitHub App, choose a repository, and we’ll queue a full scan. Built on Supabase, FastAPI, and
            GitHub Apps.
          </p>
          <div className="flex gap-3">
            <Link href="/login">
              <Button>Get started</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Go to dashboard</Button>
            </Link>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>What’s ready</CardTitle>
            <CardDescription>Phase 2: Auth, installations, repo connect & queue.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="rounded-md bg-muted p-3 text-sm text-mutedForeground">Supabase GitHub auth</div>
            <div className="rounded-md bg-muted p-3 text-sm text-mutedForeground">Org-aware GitHub installations</div>
            <div className="rounded-md bg-muted p-3 text-sm text-mutedForeground">Repo listing per installation</div>
            <div className="rounded-md bg-muted p-3 text-sm text-mutedForeground">Queue full_scan on connect</div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

