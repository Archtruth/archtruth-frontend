"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { presignWikiPage } from "@/lib/api/backend-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, Calendar, Loader, BookOpen, Menu } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { MermaidBlock } from "@/components/markdown/MermaidBlock";

type WikiPage = {
  id: number;
  slug: string;
  title: string;
  category?: string;
  nav_order?: number;
  updated_at?: string;
};

async function fetchWikiContent(repoId: number, slug: string, token: string): Promise<string> {
  const presigned = await presignWikiPage(repoId, slug, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch wiki page");
  }
  return resp.text();
}

export function RepoWikiPageClient({
  repoId,
  token,
  backHref,
  pages,
}: {
  repoId: number;
  token: string;
  backHref: string;
  pages: WikiPage[];
}) {
  const [selectedSlug, setSelectedSlug] = useState<string>(pages.length > 0 ? pages[0].slug : "");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!selectedSlug) return;
    const run = async () => {
      setLoading(true);
      try {
        const content = await fetchWikiContent(repoId, selectedSlug, token);
        setMarkdown(content);
      } catch (e) {
        console.error("Failed to load wiki page:", e);
        setMarkdown("Failed to load wiki page.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [repoId, selectedSlug, token]);

  const selected = pages.find((p) => p.slug === selectedSlug);

  // Group pages by category
  const groupedPages = pages.reduce((acc, page) => {
    const cat = page.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(page);
    return acc;
  }, {} as Record<string, WikiPage[]>);

  // Sort pages within each category by nav_order then title
  Object.keys(groupedPages).forEach((cat) => {
    groupedPages[cat] = groupedPages[cat].slice().sort((a, b) => {
      const ao = a.nav_order ?? 0;
      const bo = b.nav_order ?? 0;
      if (ao !== bo) return ao - bo;
      return a.title.localeCompare(b.title);
    });
  });

  // Custom sort order for standard categories
  const categoryOrder = ["overview", "architecture", "guides", "modules", "api", "generated", "general"];
  const sortedCategories = Object.keys(groupedPages).sort((a, b) => {
    const ia = categoryOrder.indexOf(a.toLowerCase());
    const ib = categoryOrder.indexOf(b.toLowerCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Repository Wiki
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            <Menu className="h-5 w-5" />
          </Button>
          <Link href={backHref}>
            <Button variant="outline" size="sm">Back to Repos</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-64 border-r bg-muted/10 overflow-y-auto transition-transform duration-200 ease-in-out absolute md:relative z-20 h-full md:translate-x-0 bg-background md:bg-transparent",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="p-4 space-y-6">
            {pages.length === 0 ? (
              <p className="text-sm text-muted-foreground p-2">No pages found.</p>
            ) : (
              sortedCategories.map((category) => (
                <div key={category}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {groupedPages[category].map((page) => (
                      <button
                        key={page.slug}
                        onClick={() => {
                          setSelectedSlug(page.slug);
                          setMobileMenuOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-2 py-1.5 text-sm rounded-md transition-colors",
                          selectedSlug === page.slug
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted text-foreground/80 hover:text-foreground"
                        )}
                      >
                        {page.title}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background p-8">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <BookOpen className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">Wiki is empty</h3>
              <p className="text-muted-foreground max-w-sm mt-2">
                Sync the repository to generate documentation.
              </p>
            </div>
          ) : !selectedSlug ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <FileText className="h-12 w-12 mb-4 opacity-20" />
              <p>Select a page from the sidebar to view content.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto">
              <div className="mb-8 border-b pb-4">
                <h1 className="text-3xl font-bold mb-2">{selected?.title}</h1>
                {selected?.updated_at && (
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-1" />
                    Last updated: {new Date(selected.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <article className="prose dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      pre: ({ children, ...props }) => {
                        // `react-markdown` wraps fenced code blocks in <pre>. Our wiki content should
                        // always render these in light mode (even if the app is in dark mode), so we
                        // render a light-styled <pre> and opt out of `prose` styling via `not-prose`.
                        return (
                          <pre
                            {...props}
                            className={cn(
                              "not-prose my-4 rounded-md border bg-white text-black p-3 overflow-x-auto text-sm",
                              (props as any)?.className
                            )}
                          >
                            {children}
                          </pre>
                        );
                      },
                      a: ({ href, children, ...props }) => {
                        const h = href || "";
                        if (h.startsWith("wiki:")) {
                          const target = h.slice("wiki:".length);
                          return (
                            <button
                              type="button"
                              className="text-primary underline underline-offset-4 hover:opacity-90"
                              onClick={() => setSelectedSlug(target)}
                            >
                              {children}
                            </button>
                          );
                        }
                        return (
                          <a href={href} {...props} target="_blank" rel="noreferrer">
                            {children}
                          </a>
                        );
                      },
                      code: ({ className, children, ...props }: any) => {
                        const text = String(children ?? "").replace(/\n$/, "");
                        const match = /language-(\w+)/.exec(className || "");
                        if (match?.[1] === "mermaid") {
                          return <MermaidBlock code={text} />;
                        }
                        return (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {markdown}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
