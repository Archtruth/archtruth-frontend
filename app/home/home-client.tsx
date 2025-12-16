"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Book, Database, FileText, Github, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { LoginForm } from "@/app/login/login-form";

type HomeClientProps = {
  initialLoginOpen?: boolean;
  initialError?: string | null;
};

export function HomeClient({ initialLoginOpen = false, initialError }: HomeClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [loginOpen, setLoginOpen] = React.useState<boolean>(initialLoginOpen);

  const errorFromUrl = searchParams.get("error");
  const error = errorFromUrl || initialError || null;

  function setLoginOpenAndSyncUrl(open: boolean) {
    setLoginOpen(open);
    const next = new URLSearchParams(searchParams.toString());
    if (open) {
      next.set("login", "1");
    } else {
      next.delete("login");
      next.delete("error");
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <Book className="h-6 w-6" />
            <span>ArchTruth</span>
          </Link>
          <nav className="flex items-center gap-4">
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
        <section className="space-y-6 pb-8 pt-12 md:pb-12 md:pt-20 lg:py-32">
          <div className="container mx-auto flex max-w-[64rem] flex-col items-center gap-6 px-6 text-center">
            <Link
              href="https://github.com"
              className="rounded-2xl bg-muted px-4 py-1.5 text-sm font-medium"
              target="_blank"
            >
              Follow on GitHub
            </Link>
            <h1 className="font-heading text-4xl font-bold sm:text-5xl md:text-6xl lg:text-7xl">
              Documentation that <br /> writes itself.
            </h1>
            <p className="max-w-[42rem] leading-normal text-mutedForeground sm:text-xl sm:leading-8">
              Connect your repositories and let our AI agents generate comprehensive, up-to-date documentation.
              Architecture diagrams, API specs, and more—automatically.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button size="lg" className="h-12 px-8 text-lg" onClick={() => setLoginOpenAndSyncUrl(true)}>
                Start Building <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link href="#features">
                <Button variant="outline" size="lg" className="h-12 px-8 text-lg">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="container mx-auto space-y-12 py-12 md:py-24 lg:py-32 px-6">
          <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
            <h2 className="font-heading text-3xl font-bold leading-[1.1] sm:text-3xl md:text-6xl">Features</h2>
            <p className="max-w-[85%] leading-normal text-mutedForeground sm:text-lg sm:leading-7">
              Built using latest LLMs to deliver accurate technical documentation.
            </p>
          </div>
          <div className="mx-auto grid justify-center gap-4 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
            <Card className="flex flex-col items-center text-center p-4">
              <CardHeader>
                <Github className="h-10 w-10 text-primary mb-2" />
                <CardTitle>GitHub Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-mutedForeground">
                  Seamlessly connect your organizations and repositories with our GitHub App.
                </p>
              </CardContent>
            </Card>
            <Card className="flex flex-col items-center text-center p-4">
              <CardHeader>
                <Zap className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Instant Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-mutedForeground">
                  Our agents scan your codebase to understand structure, dependencies, and logic.
                </p>
              </CardContent>
            </Card>
            <Card className="flex flex-col items-center text-center p-4">
              <CardHeader>
                <FileText className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Auto-Docs</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-mutedForeground">
                  Get READMEs, API references, and architecture overviews generated automatically.
                </p>
              </CardContent>
            </Card>
            <Card className="flex flex-col items-center text-center p-4">
              <CardHeader>
                <Database className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Knowledge Base</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-mutedForeground">
                  Chat with your documentation to find answers instantly.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 md:py-0">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row px-6">
          <p className="text-center text-sm leading-loose text-mutedForeground md:text-left">
            Built by{" "}
            <a href="#" className="font-medium underline underline-offset-4">
              ArchTruth
            </a>
          </p>
        </div>
      </footer>

      <Modal
        open={loginOpen}
        onOpenChange={setLoginOpenAndSyncUrl}
        title="Sign in to ArchTruth"
      >
        <LoginForm variant="embedded" error={error} />
      </Modal>
    </div>
  );
}


