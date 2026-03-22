"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Book,
  FolderTree,
  Github,
  Loader2,
  Map,
  MessageSquare,
  Network,
  RefreshCw,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/app/login/login-form";
import { ThemeToggle } from "@/components/theme-toggle";

type HomeClientProps = {
  initialLoginOpen?: boolean;
  initialError?: string | null;
};

const features = [
  {
    icon: Network,
    title: "Architecture Map",
    desc: "Interactive service graph with capability grouping and dependency visualization.",
  },
  {
    icon: Book,
    title: "Living Wiki",
    desc: "Auto-generated docs that stay in sync with every push. Module-level detail.",
  },
  {
    icon: MessageSquare,
    title: "AI Chat",
    desc: "Ask questions about your architecture, dependencies, and code flow with citations.",
  },
  {
    icon: FolderTree,
    title: "Capability Hierarchy",
    desc: "Organize services into business domains: L0-L3 hierarchy.",
  },
  {
    icon: RefreshCw,
    title: "Always Fresh",
    desc: "Webhooks trigger incremental re-analysis. Only changed files re-scanned.",
  },
  {
    icon: Github,
    title: "GitHub Native",
    desc: "Install the GitHub App, pick repos, docs generate automatically.",
  },
];

export function HomeClient({ initialLoginOpen = false, initialError }: HomeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loginOpen, setLoginOpen] = React.useState<boolean>(initialLoginOpen);
  const [navigating, setNavigating] = React.useState(false);

  const errorFromUrl = searchParams.get("error");
  const noticeFromUrl = searchParams.get("notice");
  const error =
    errorFromUrl === "session_expired"
      ? "Please sign in again to continue."
      : errorFromUrl || initialError || null;
  const signInNotice =
    noticeFromUrl === "account_deleted"
      ? "Your account was removed. Sign in with GitHub to create a fresh account."
      : null;

  function setLoginOpenAndSyncUrl(open: boolean) {
    setLoginOpen(open);
    const next = new URLSearchParams(searchParams.toString());
    if (open) {
      next.set("login", "1");
    } else {
      next.delete("login");
      next.delete("error");
      next.delete("notice");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  function handleSignIn() {
    if (navigating) return;
    setNavigating(true);
    window.location.href = "/auth/login";
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Book className="h-3.5 w-3.5" />
            </div>
            ArchTruth
          </Link>
          <nav className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => setLoginOpenAndSyncUrl(true)}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => setLoginOpenAndSyncUrl(true)}>
              Get Started
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center py-24 md:py-32 lg:py-40 px-6">
          <div className="max-w-3xl text-center space-y-6">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-transparent">
              Your codebase, understood.
            </h1>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
              ArchTruth maps your microservices architecture, generates living documentation,
              and lets you chat with your entire codebase — powered by AI.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button size="lg" className="h-12 px-8 gap-2" onClick={() => setLoginOpenAndSyncUrl(true)}>
                Get Started with GitHub <ArrowRight className="h-4 w-4" />
              </Button>
              <a href="#features">
                <Button variant="outline" size="lg" className="h-12 px-8">
                  See how it works
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-6 border-t bg-muted/30">
          <div className="container mx-auto max-w-screen-xl">
            <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((f) => (
                <Card key={f.title} className="hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 px-6 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to understand your codebase?</h2>
          <Button size="lg" className="h-12 px-8 gap-2" onClick={() => setLoginOpenAndSyncUrl(true)}>
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container mx-auto flex items-center justify-center px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Book className="h-3.5 w-3.5" />
            ArchTruth
          </div>
        </div>
      </footer>

      {/* Login Modal */}
      <Modal open={loginOpen} onOpenChange={setLoginOpenAndSyncUrl} title="Sign in to ArchTruth">
        <LoginForm variant="embedded" error={error} notice={signInNotice} onSignIn={handleSignIn} />
      </Modal>

      {navigating && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/90 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Redirecting to GitHub…</p>
        </div>
      )}
    </div>
  );
}
