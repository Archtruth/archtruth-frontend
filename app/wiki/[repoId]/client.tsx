"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { presignWikiPage, presignOrgDocument } from "@/lib/api/backend-client";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, Calendar, Loader, BookOpen, Search, ChevronRight, ChevronDown, Folder, FolderOpen, ExternalLink, Code } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { MermaidBlock } from "@/components/markdown/MermaidBlock";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type WikiPage = {
  id: number;
  slug: string;
  title: string;
  category?: string;
  nav_order?: number;
  updated_at?: string;
  last_indexed_commit_sha?: string;
  indexed_at?: string;
};

type OrgDoc = {
  id: number;
  file_path: string;
  updated_at?: string;
};

type Service = {
  name: string;
  modules: WikiPage[];
};

const ORG_DOC_DISPLAY_NAMES: Record<string, string> = {
  org_overview: "Overview",
  org_architecture: "Architecture",
  org_services: "Service Catalog",
  org_interfaces: "Interfaces",
};

function getOrgDocDisplayName(filePath: string): string {
  const key = filePath.replace(/\.(md|mdx)$/i, "");
  return ORG_DOC_DISPLAY_NAMES[key] ?? filePath.replace(/\.(md|mdx)$/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchWikiContent(repoId: number, slug: string, token: string): Promise<string> {
  const presigned = await presignWikiPage(repoId, slug, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch wiki page");
  }
  return resp.text();
}

async function fetchOrgDocContent(orgId: string, fileName: string, token: string): Promise<string> {
  const presigned = await presignOrgDocument(orgId, fileName, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch org document");
  }
  return resp.text();
}

export function FullScreenWikiClient({
  repoId,
  orgId,
  token,
  backHref,
  pages,
  orgDocs,
}: {
  repoId: number;
  orgId?: string;
  token: string;
  backHref: string;
  pages: WikiPage[];
  orgDocs: OrgDoc[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<"org-doc" | "module">("org-doc");
  const [selectedOrgDoc, setSelectedOrgDoc] = useState<string>("");
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [services, setServices] = useState<Service[]>([]);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = sessionStorage.getItem("wiki-expanded-services");
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });

  const toggleServiceExpanded = useCallback((serviceName: string) => {
    setExpandedServices((prev) => {
      const next = new Set(prev);
      if (next.has(serviceName)) {
        next.delete(serviceName);
      } else {
        next.add(serviceName);
      }
      try {
        sessionStorage.setItem("wiki-expanded-services", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const initializeFromWikiPages = useCallback(() => {
    const serviceMap = new Map<string, WikiPage[]>();
    const normalizeSlug = (slug: string) => slug.replace(/\.(md|mdx)$/i, "");
    const SYNTHETIC_PREFIXES = ["modules", "api", "architecture", "configuration", "guides", "generated", "general"];

    pages.forEach((page) => {
      const normalized = normalizeSlug(page.slug);
      const parts = normalized.split("/").filter(Boolean);
      let serviceName: string;
      if (parts.length > 1 && SYNTHETIC_PREFIXES.includes(parts[0].toLowerCase())) {
        serviceName = parts[1];
      } else if (parts.length > 1) {
        serviceName = parts[0];
      } else {
        serviceName = page.category && page.category.trim().length > 0 ? page.category : "overview";
      }
      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, []);
      }
      serviceMap.get(serviceName)!.push(page);
    });

    const servicesArray: Service[] = Array.from(serviceMap.entries())
      .map(([name, modules]) => ({
        name,
        modules: modules.sort((a, b) => {
          const aOrder = a.nav_order ?? 0;
          const bOrder = b.nav_order ?? 0;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.title.localeCompare(b.title);
        }),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setServices(servicesArray);
  }, [pages]);

  // Always initialize navigation from real wiki pages.
  // org_services.md remains useful as a content doc, but should not define module slugs.
  useEffect(() => {
    initializeFromWikiPages();
  }, [initializeFromWikiPages]);

  // Initialize selection from URL or defaults
  useEffect(() => {
    const orgDocParam = searchParams?.get("org_doc");
    const serviceParam = searchParams?.get("service");
    const moduleParam = searchParams?.get("module");

    if (orgDocParam && orgDocs.length > 0) {
      const doc = orgDocs.find((d) => d.file_path === orgDocParam);
      if (doc) {
        setSelectedType("org-doc");
        setSelectedOrgDoc(orgDocParam);
        setSelectedService(null);
        setSelectedModule("");
        return;
      }
    }

    if (serviceParam && moduleParam) {
      const service = services.find((s) => s.name === serviceParam);
      if (service) {
        const modulePage = service.modules.find((m) => m.slug === moduleParam);
        if (modulePage) {
          setSelectedType("module");
          setSelectedService(serviceParam);
          setSelectedModule(moduleParam);
          setSelectedOrgDoc("");
          return;
        }
      }
    }

    // Default to the first module when available so "View Wiki" opens repo docs immediately.
    if (services.length > 0 && services[0].modules.length > 0) {
      setSelectedType("module");
      setSelectedService(services[0].name);
      setSelectedModule(services[0].modules[0].slug);
    } else if (orgDocs.length > 0) {
      setSelectedType("org-doc");
      setSelectedOrgDoc(orgDocs[0].file_path);
    }
  }, [orgDocs, services, searchParams]);

  // Keep expanded state in sync when selecting a module
  useEffect(() => {
    if (selectedService && !expandedServices.has(selectedService)) {
      setExpandedServices((prev) => {
        const next = new Set(prev);
        next.add(selectedService);
        try {
          sessionStorage.setItem("wiki-expanded-services", JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
  }, [selectedService]);

  // Load content when selection changes
  useEffect(() => {
    if (selectedType === "org-doc" && selectedOrgDoc && orgId) {
      setLoading(true);
      fetchOrgDocContent(orgId, selectedOrgDoc, token)
        .then((content) => {
          setMarkdown(content);
          setLoading(false);
        })
        .catch((e) => {
          console.error("Failed to load org doc:", e);
          setMarkdown("Failed to load document.");
          setLoading(false);
        });
    } else if (selectedType === "module" && selectedModule) {
      setLoading(true);
      fetchWikiContent(repoId, selectedModule, token)
        .then((content) => {
          setMarkdown(content);
          setLoading(false);
        })
        .catch((e) => {
          console.error("Failed to load wiki page:", e);
          setMarkdown("Failed to load wiki page.");
          setLoading(false);
        });
    }
  }, [selectedType, selectedOrgDoc, selectedModule, repoId, orgId, token]);


  const handleSelectOrgDoc = useCallback((filePath: string) => {
    setSelectedType("org-doc");
    setSelectedOrgDoc(filePath);
    setSelectedService(null);
    setSelectedModule("");
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("org_doc", filePath);
    params.delete("service");
    params.delete("module");
    router.push(`/wiki/${repoId}?${params.toString()}`, { scroll: false });
  }, [repoId, router, searchParams]);

  const handleSelectModule = useCallback((serviceName: string, moduleSlug: string) => {
    setSelectedType("module");
    setSelectedService(serviceName);
    setSelectedModule(moduleSlug);
    setSelectedOrgDoc("");
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("service", serviceName);
    params.set("module", moduleSlug);
    params.delete("org_doc");
    router.push(`/wiki/${repoId}?${params.toString()}`, { scroll: false });
  }, [repoId, router, searchParams]);

  const selectedPage = useMemo(() => {
    if (selectedType === "module" && selectedModule) {
      return pages.find((p) => p.slug === selectedModule);
    }
    return null;
  }, [selectedType, selectedModule, pages]);

  const selectedDoc = useMemo(() => {
    if (selectedType === "org-doc" && selectedOrgDoc) {
      return orgDocs.find((d) => d.file_path === selectedOrgDoc);
    }
    return null;
  }, [selectedType, selectedOrgDoc, orgDocs]);

  const filteredPages = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const results: Array<{ type: "org-doc" | "module"; title: string; subtitle: string; preview?: string; score: number; action: () => void }> = [];

    const scoreMatch = (text: string): number => {
      const lower = text.toLowerCase();
      if (lower === q) return 100;
      if (lower.startsWith(q)) return 80;
      if (lower.includes(q)) return 60;
      if (words.every((w) => lower.includes(w))) return 40;
      if (words.some((w) => lower.includes(w))) return 20;
      return 0;
    };

    orgDocs.forEach((doc) => {
      const displayName = getOrgDocDisplayName(doc.file_path);
      const score = Math.max(scoreMatch(doc.file_path), scoreMatch(displayName));
      if (score > 0) {
        results.push({
          type: "org-doc",
          title: displayName,
          subtitle: "Getting Started",
          score,
          action: () => handleSelectOrgDoc(doc.file_path),
        });
      }
    });

    services.forEach((service) => {
      service.modules.forEach((module) => {
        const score = Math.max(
          scoreMatch(module.title),
          scoreMatch(module.slug),
          scoreMatch(service.name),
          scoreMatch(module.category ?? "")
        );
        if (score > 0) {
          results.push({
            type: "module",
            title: module.title,
            subtitle: `${service.name} / ${module.slug}`,
            preview: module.category ? `Category: ${module.category}` : undefined,
            score,
            action: () => handleSelectModule(service.name, module.slug),
          });
        }
      });
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 15);
  }, [searchQuery, orgDocs, services, handleSelectOrgDoc, handleSelectModule]);

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Wiki</p>
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-semibold">Knowledge Base</h1>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-40 justify-start text-muted-foreground">
                  <Search className="mr-2 h-4 w-4" />
                  Search...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-2">
                  <Input
                    placeholder="Search pages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8"
                    autoFocus
                  />
                </div>
                {searchQuery && (
                  <div className="max-h-60 overflow-y-auto border-t">
                    {filteredPages.length > 0 ? (
                      <div className="p-1">
                        {filteredPages.map((item, idx) => (
                          <button
                            key={idx}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted rounded-sm flex flex-col gap-0.5"
                            onClick={() => {
                              item.action();
                              setSearchOpen(false);
                            }}
                          >
                            <span className="font-medium truncate">{item.title}</span>
                            <span className="text-xs text-muted-foreground truncate">{item.subtitle}</span>
                            {item.preview && (
                              <span className="text-[10px] text-muted-foreground/80 truncate">{item.preview}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="p-4 text-sm text-center text-muted-foreground">No results found.</p>
                    )}
                  </div>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Services */}
        <aside className="w-72 border-r bg-background/95 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Metadata Section - Version & Staleness */}
            {(selectedPage || selectedDoc) && (() => {
              const updatedAt = selectedPage?.updated_at || selectedDoc?.updated_at;
              const commitSha = selectedPage?.last_indexed_commit_sha;
              if (!updatedAt) return null;
              const date = new Date(updatedAt);
              const now = new Date();
              const daysSince = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
              const staleness = daysSince <= 1 ? "fresh" : daysSince <= 7 ? "recent" : "stale";
              const stalenessColors = {
                fresh: "text-emerald-600 dark:text-emerald-400",
                recent: "text-amber-600 dark:text-amber-400",
                stale: "text-red-600 dark:text-red-400",
              };
              return (
                <div className="px-2 py-2 border-b border-border/60 mb-2 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Last indexed: {date.toLocaleDateString()}
                  </p>
                  {commitSha && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Version</span>
                      <code className={cn("text-[11px] font-mono px-1.5 py-0.5 rounded", stalenessColors[staleness])}>
                        {commitSha.substring(0, 7)}
                      </code>
                    </div>
                  )}
                  <p className={cn("text-[10px] font-medium", stalenessColors[staleness])}>
                    {staleness === "fresh" ? "Up to date" : staleness === "recent" ? "Consider re-syncing" : "Stale — re-sync recommended"}
                  </p>
                </div>
              );
            })()}

            {/* Getting Started - Org Docs */}
            {orgDocs.length > 0 && (
              <div className="space-y-2">
                <div className="px-2 py-1">
                  <h2 className="text-sm font-semibold text-foreground">Getting Started</h2>
                </div>
                <div className="space-y-1">
                  {orgDocs.map((doc) => {
                    const isSelected = selectedType === "org-doc" && selectedOrgDoc === doc.file_path;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => handleSelectOrgDoc(doc.file_path)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded-md border transition-colors text-sm",
                          isSelected
                            ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                            : "border-transparent hover:border-border hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{getOrgDocDisplayName(doc.file_path)}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Services Section */}
            {services.length > 0 && (
              <div className="space-y-2">
                <div className="px-2 py-1">
                  <h2 className="text-sm font-semibold text-foreground">Services</h2>
                </div>
                <div className="space-y-1">
                  {services.map((service) => {
                    const isServiceSelected = selectedService === service.name;
                    const hasModules = service.modules.length > 0;
                    const isExpanded = expandedServices.has(service.name);

                    return (
                      <div key={service.name} className="space-y-1">
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-sm cursor-pointer",
                            isServiceSelected
                              ? "border-primary/50 bg-primary/5"
                              : "border-transparent hover:border-border hover:bg-muted/50"
                          )}
                          onClick={() => {
                            if (hasModules) {
                              handleSelectModule(service.name, service.modules[0].slug);
                            }
                          }}
                        >
                          <button
                            type="button"
                            data-expand-toggle
                            className="p-0.5 -m-0.5 rounded hover:bg-muted/80 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasModules) toggleServiceExpanded(service.name);
                            }}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {hasModules ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : null}
                          </button>
                          {isServiceSelected ? (
                            <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="flex-1 truncate font-medium">{service.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">[{service.modules.length}]</span>
                        </div>

                        {/* Modules under service - show when expanded */}
                        {isExpanded && hasModules && (
                          <div className="ml-6 space-y-1 border-l border-border/60 pl-2">
                            {service.modules.map((module) => {
                              const isModuleSelected = selectedModule === module.slug;
                              return (
                                <button
                                  key={module.id}
                                  onClick={() => handleSelectModule(service.name, module.slug)}
                                  className={cn(
                                    "w-full text-left px-3 py-2 rounded-md border transition-colors text-sm",
                                    isModuleSelected
                                      ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                                      : "border-transparent hover:border-border hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                                  )}
                                >
                                  <span className="truncate">{module.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {orgDocs.length === 0 && services.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No content available.</p>
              </div>
            )}
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedType === "org-doc" && selectedDoc ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Getting Started</p>
                      <h1 className="text-3xl font-bold leading-tight">{getOrgDocDisplayName(selectedDoc.file_path)}</h1>
                    </div>
                  </div>
                  {selectedDoc.updated_at && (
                    <div className="mt-4 flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Last updated: {new Date(selectedDoc.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <article className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h4:text-lg prose-h4:mt-4 prose-h4:mb-2 prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h2 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h2>
                          );
                        },
                        h3: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h3 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h3>
                          );
                        },
                        h4: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h4 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h4>
                          );
                        },
                        pre: ({ children, ...props }) => {
                          const childClass =
                            (props as any)?.children?.props?.className ||
                            (Array.isArray(children) && (children as any)[0]?.props?.className) ||
                            "";
                          const isMermaid = childClass.includes("language-mermaid");

                          if (isMermaid) {
                            return <div className="not-prose my-6">{children}</div>;
                          }

                          return (
                            <pre
                              {...props}
                              className={cn(
                                "not-prose my-4 rounded-md border bg-muted/50 p-4 overflow-x-auto text-sm",
                                (props as any)?.className
                              )}
                            >
                              {children}
                            </pre>
                          );
                        },
                        code: ({ className, children, ...props }: any) => {
                          const text = String(children ?? "").replace(/\n$/, "");
                          const match = /language-(\w+)/.exec(className || "");
                          if (match?.[1] === "mermaid") {
                            return <MermaidBlock code={text} />;
                          }
                          return (
                            <code className={cn("bg-muted/50 px-1.5 py-0.5 rounded text-sm", className)} {...props}>
                              {children}
                            </code>
                          );
                        },
                      }}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            ) : selectedType === "module" && selectedPage ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Module</p>
                      <h1 className="text-3xl font-bold leading-tight">{selectedPage.title}</h1>
                      <p className="text-sm text-muted-foreground mt-1">{selectedPage.slug}</p>
                    </div>
                  </div>
                  {selectedPage.updated_at && (
                    <div className="mt-4 flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-2" />
                      Last updated: {new Date(selectedPage.updated_at).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <article className="prose dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-headings:font-semibold prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3 prose-h4:text-lg prose-h4:mt-4 prose-h4:mb-2 prose-p:my-4 prose-ul:my-4 prose-ol:my-4 prose-li:my-1">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h2: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h2 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h2>
                          );
                        },
                        h3: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h3 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h3>
                          );
                        },
                        h4: ({ children, ...props }) => {
                          const title = String(children);
                          const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
                          return (
                            <h4 id={id} className="scroll-mt-24" {...props}>
                              {children}
                            </h4>
                          );
                        },
                        pre: ({ children, ...props }) => {
                          const childClass =
                            (props as any)?.children?.props?.className ||
                            (Array.isArray(children) && (children as any)[0]?.props?.className) ||
                            "";
                          const isMermaid = childClass.includes("language-mermaid");

                          if (isMermaid) {
                            return <div className="not-prose my-6">{children}</div>;
                          }

                          return (
                            <pre
                              {...props}
                              className={cn(
                                "not-prose my-4 rounded-md border bg-muted/50 p-4 overflow-x-auto text-sm",
                                (props as any)?.className
                              )}
                            >
                              {children}
                            </pre>
                          );
                        },
                        code: ({ className, children, ...props }: any) => {
                          const text = String(children ?? "").replace(/\n$/, "");
                          const match = /language-(\w+)/.exec(className || "");
                          if (match?.[1] === "mermaid") {
                            return <MermaidBlock code={text} />;
                          }
                          return (
                            <code className={cn("bg-muted/50 px-1.5 py-0.5 rounded text-sm", className)} {...props}>
                              {children}
                            </code>
                          );
                        },
                        a: ({ href, children, ...props }) => {
                          const h = href || "";
                          if (h.startsWith("wiki:")) {
                            const target = h.slice("wiki:".length);
                            const withRepo = target.includes("/");
                            const [repoPart, slugPart] = withRepo ? target.split("/") : [null, target];
                            const slug = slugPart ?? target;
                            if (repoPart) {
                              const otherRepoId = parseInt(repoPart, 10);
                              if (!isNaN(otherRepoId) && otherRepoId !== repoId && orgId) {
                                return (
                                  <Link
                                    href={`/wiki?org_id=${encodeURIComponent(orgId)}&repo=${otherRepoId}&module=${encodeURIComponent(slug)}`}
                                    className="text-primary underline underline-offset-4 hover:opacity-90"
                                  >
                                    {children}
                                  </Link>
                                );
                              }
                            }
                            const modulePage = pages.find((p) => p.slug === slug);
                            if (modulePage) {
                              const service = services.find((s) =>
                                s.modules.some((m) => m.slug === slug)
                              );
                              if (service) {
                                return (
                                  <button
                                    type="button"
                                    className="text-primary underline underline-offset-4 hover:opacity-90"
                                    onClick={() => handleSelectModule(service.name, slug)}
                                  >
                                    {children}
                                  </button>
                                );
                              }
                            }
                          }
                          // Handle code: protocol links (render file path inline)
                          if (h.startsWith("code:")) {
                            const filePath = h.slice("code:".length);
                            return (
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Code className="h-3 w-3 inline flex-shrink-0" />
                                <code className="text-sm bg-muted/50 px-1 py-0.5 rounded">{filePath}</code>
                              </span>
                            );
                          }
                          // GitHub / source code links — show with code icon
                          const isCodeLink = h.includes("/blob/") || h.includes("/-/blob/") || h.includes("/src/");
                          return (
                            <a
                              href={h}
                              {...props}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(
                                "underline underline-offset-4 hover:opacity-90",
                                isCodeLink
                                  ? "text-blue-600 dark:text-blue-400 inline-flex items-center gap-1"
                                  : "text-primary"
                              )}
                            >
                              {isCodeLink && <Code className="h-3 w-3 inline flex-shrink-0" />}
                              {children}
                              {isCodeLink && <ExternalLink className="h-3 w-3 inline flex-shrink-0 opacity-50" />}
                            </a>
                          );
                        },
                      }}
                    >
                      {markdown}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-24">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p>Select a document or module from the sidebar to view content.</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Table of Contents */}
        <aside className="hidden lg:block w-64 border-l bg-background/95 overflow-y-auto">
          <div className="p-6">
            {(selectedType === "module" || selectedType === "org-doc") && markdown && (
              <TableOfContents markdown={markdown} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

