"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { presignWikiPage } from "@/lib/api/backend-client";
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

type NavNode = {
  id: string;
  label: string;
  slug?: string;
  path: string;
  children: NavNode[];
  order?: number;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const slugFromUrl = searchParams?.get("page") || "";
  const initialSlug = slugFromUrl || (pages.length > 0 ? pages[0].slug : "");

  const [selectedSlug, setSelectedSlug] = useState<string>(initialSlug);
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Keep local state in sync with the URL so browser back/forward works.
    if (slugFromUrl && slugFromUrl !== selectedSlug) {
      setSelectedSlug(slugFromUrl);
      return;
    }

    // If there is no slug in the URL yet, seed it with the first page for a consistent deep link.
    if (!slugFromUrl && pages.length > 0 && selectedSlug !== pages[0].slug) {
      setSelectedSlug(pages[0].slug);
      router.replace(`${pathname}?page=${encodeURIComponent(pages[0].slug)}`, { scroll: false });
    }
  }, [pages, pathname, router, selectedSlug, slugFromUrl]);

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

  const normalizeSlug = (slug?: string) => (slug || "").replace(/\.(md|mdx)$/i, "");
  const humanize = (segment: string) =>
    segment
      .replace(/\.(md|mdx)$/i, "")
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

  const navTree = useMemo(() => {
    const tree: Record<string, NavNode[]> = {};

    pages.forEach((page) => {
      const category = page.category || "General";
      if (!tree[category]) tree[category] = [];

      const normalized = normalizeSlug(page.slug);
      const segments = normalized.split("/").filter(Boolean);
      const safeSegments = segments.length ? segments : [normalized || "page"];

      let current = tree[category];
      let pathAcc = "";

      safeSegments.forEach((segment, idx) => {
        pathAcc = pathAcc ? `${pathAcc}/${segment}` : segment;
        const isLeaf = idx === safeSegments.length - 1;
        const id = `${category}-${pathAcc}`;
        let node = current.find((n) => n.id === id);

        if (!node) {
          node = {
            id,
            label: isLeaf ? page.title || humanize(segment) : humanize(segment),
            slug: isLeaf ? page.slug : undefined,
            path: pathAcc,
            children: [],
            order: isLeaf ? page.nav_order ?? 0 : page.nav_order ?? 0,
          };
          current.push(node);
        }
        current = node.children;
      });
    });

    const sortNodes = (nodes: NavNode[]) => {
      nodes.sort((a, b) => {
        const ao = a.order ?? 0;
        const bo = b.order ?? 0;
        if (ao !== bo) return ao - bo;
        return a.label.localeCompare(b.label);
      });
      nodes.forEach((child) => sortNodes(child.children));
    };

    Object.values(tree).forEach((nodes) => sortNodes(nodes));
    return tree;
  }, [pages]);

  const categoryOrder = ["overview", "architecture", "guides", "modules", "api", "generated", "general"];
  const sortedCategories = useMemo(() => {
    const categories = Object.keys(navTree);
    return categories.sort((a, b) => {
      const ia = categoryOrder.indexOf(a.toLowerCase());
      const ib = categoryOrder.indexOf(b.toLowerCase());
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [navTree]);

  const activePath = normalizeSlug(selectedSlug);

  const handleSelect = (slug: string) => {
    if (!slug) return;
    // Drive state from the URL to avoid double loads; the sync effect updates `selectedSlug`.
    router.push(`${pathname}?page=${encodeURIComponent(slug)}`, { scroll: false });
    setMobileMenuOpen(false);
  };

  const renderTree = (nodes: NavNode[], depth = 0) =>
    nodes.map((node) => {
      const isActive = node.slug === selectedSlug;
      const isTrail = !node.slug && activePath.startsWith(node.path);
      const paddingLeft = depth === 0 ? undefined : depth * 12;

      return (
        <div key={node.id} className="space-y-1">
          {node.slug ? (
            <button
              onClick={() => handleSelect(node.slug!)}
              style={{ paddingLeft }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md border transition-colors text-sm",
                isActive
                  ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                  : "border-transparent hover:border-border hover:bg-muted/70 text-foreground/80 hover:text-foreground"
              )}
            >
              <span className="truncate">{node.label}</span>
            </button>
          ) : (
            <div
              style={{ paddingLeft }}
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80",
                isTrail && "text-foreground"
              )}
            >
              {node.label}
            </div>
          )}

          {node.children.length > 0 && (
            <div className="pl-3 ml-[6px] border-l border-border/60 space-y-1">
              {renderTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/40">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9" />
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Wiki</p>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Repository Knowledge Base</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-80px)]">
        {/* Sidebar */}
        <aside
          className={cn(
            "relative md:static z-20 h-full w-full md:w-72 lg:w-80 border-r bg-background/95 backdrop-blur md:translate-x-0 transition-transform duration-200 ease-in-out",
            mobileMenuOpen ? "translate-x-0 shadow-lg" : "translate-x-[-100%] md:translate-x-0"
          )}
        >
          <div className="h-full flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b">
              <h2 className="text-sm font-semibold text-foreground/80">Components</h2>
              <p className="text-xs text-muted-foreground">Browse wiki modules</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-6">
                {pages.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No pages found.</p>
                ) : (
                  sortedCategories.map((category) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                          {category}
                        </h3>
                        <span className="text-[11px] text-muted-foreground/70">
                          {(navTree[category]?.length || 0).toString().padStart(2, "0")}
                        </span>
                      </div>
                      <div className="space-y-2">{renderTree(navTree[category] || [])}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background/60">
          <div className="max-w-6xl mx-auto px-5 py-8 lg:px-10">
            {pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="bg-muted p-4 rounded-full mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Wiki is empty</h3>
                <p className="text-muted-foreground max-w-sm mt-2">Sync the repository to generate documentation.</p>
              </div>
            ) : !selectedSlug ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a page from the sidebar to view content.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Component</p>
                      <h1 className="text-3xl font-bold leading-tight">{selected?.title}</h1>
                      <p className="text-sm text-muted-foreground mt-1">{selectedSlug}</p>
                    </div>
                  </div>
                  {selected?.updated_at && (
                    <div className="mt-4 flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Last updated: {new Date(selected.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <article className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-24">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          pre: ({ children, ...props }) => {
                            const childClass =
                              (props as any)?.children?.props?.className || (Array.isArray(children) && (children as any)[0]?.props?.className) || "";
                            const isMermaid = childClass.includes("language-mermaid");

                            // For mermaid, let the diagram render cleanly without padded/light container.
                            if (isMermaid) {
                              return <div className="not-prose my-4">{children}</div>;
                            }

                            // Default code fences: light-mode styled block with scroll.
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
                                  onClick={() => handleSelect(target)}
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
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
