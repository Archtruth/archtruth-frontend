"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { presignWikiPage, presignOrgDocument } from "@/lib/api/backend";
import { Button } from "@/components/ui/button";
import { FileText, ChevronLeft, Calendar, Loader, BookOpen, Search, ChevronRight, ChevronDown, Folder, FolderOpen, ExternalLink, Code, GitBranch, Layers, Network } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { sharedMarkdownComponents } from "@/components/markdown/sharedMarkdownComponents";
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

type NavNode = {
  id: string;
  label: string;
  slug?: string;      // set only for leaf (clickable) nodes
  path: string;       // accumulated path from root, used as expand-set key
  page?: WikiPage;    // original page, only for leaf nodes
  children: NavNode[];
  order: number;
  topLevelName: string; // top-level folder name for selectedService compat
};

const ORG_DOC_META: Record<string, { label: string; icon: React.ElementType; order: number }> = {
  org_overview: { label: "Overview", icon: BookOpen, order: 0 },
  org_architecture: { label: "Architecture", icon: GitBranch, order: 1 },
  org_services: { label: "Service Catalog", icon: Layers, order: 2 },
  org_interfaces: { label: "API Reference", icon: Network, order: 3 },
};

function getOrgDocDisplayName(filePath: string): string {
  const key = filePath.replace(/\.(md|mdx)$/i, "");
  return ORG_DOC_META[key]?.label ?? filePath.replace(/\.(md|mdx)$/i, "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getOrgDocIcon(filePath: string): React.ElementType {
  const key = filePath.replace(/\.(md|mdx)$/i, "");
  return ORG_DOC_META[key]?.icon ?? FileText;
}

function getOrgDocOrder(filePath: string): number {
  const key = filePath.replace(/\.(md|mdx)$/i, "");
  return ORG_DOC_META[key]?.order ?? 99;
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

type SectionNavItem = { id: string; title: string; level: number };

function toHeadingId(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function extractSectionNav(markdown: string): SectionNavItem[] {
  if (!markdown) return [];
  const lines = markdown.split("\n");
  const out: SectionNavItem[] = [];
  const seen = new Set<string>();
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    const title = m[2].trim();
    const id = toHeadingId(title);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, title, level });
  }
  return out;
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

  // Build a hierarchical navigation tree from the wiki pages' slug paths.
  // Slugs like "archtruth-ai/services" produce nested folders.
  // Leaf nodes (that map to an actual page) are clickable; intermediate folder nodes expand/collapse.
  const navTree = useMemo((): NavNode[] => {
    const normalizeSlug = (slug: string) => slug.replace(/\.(md|mdx)$/i, "");
    const humanize = (s: string) =>
      s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const root: NavNode[] = [];

    const findOrCreate = (nodes: NavNode[], id: string, label: string, path: string, topLevelName: string, order: number): NavNode => {
      let node = nodes.find((n) => n.id === id);
      if (!node) {
        node = { id, label, path, topLevelName, children: [], order };
        nodes.push(node);
      }
      return node;
    };

    pages.forEach((page) => {
      const normalized = normalizeSlug(page.slug);
      const parts = normalized.split("/").filter(Boolean);
      if (parts.length === 0) return;

      const topLevelName = parts[0];
      let current = root;
      let pathAcc = "";

      parts.forEach((segment, idx) => {
        pathAcc = pathAcc ? `${pathAcc}/${segment}` : segment;
        const isLeaf = idx === parts.length - 1;
        const nodeId = `node-${pathAcc}`;
        const label = isLeaf ? page.title || humanize(segment) : humanize(segment);
        const order = isLeaf ? page.nav_order ?? 999 : 0;

        const node = findOrCreate(current, nodeId, label, pathAcc, topLevelName, order);

        if (isLeaf) {
          node.slug = page.slug;
          node.page = page;
          node.label = label;
        }
        current = node.children;
      });
    });

    const sortNodes = (nodes: NavNode[]): NavNode[] => {
      nodes.sort((a, b) => {
        // Folders before leaves? No — preserve natural order by nav_order then label.
        if (a.order !== b.order) return a.order - b.order;
        return a.label.localeCompare(b.label);
      });
      nodes.forEach((n) => sortNodes(n.children));
      return nodes;
    };

    return sortNodes(root);
  }, [pages]);

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

    if (moduleParam) {
      const matchingPage = pages.find((p) => p.slug === moduleParam);
      if (matchingPage) {
        const topName = moduleParam.split("/")[0];
        setSelectedType("module");
        setSelectedService(topName);
        setSelectedModule(moduleParam);
        setSelectedOrgDoc("");
        return;
      }
    }

    // Default to the first leaf page in the navTree when available.
    const findFirstLeaf = (nodes: NavNode[]): NavNode | null => {
      for (const n of nodes) {
        if (n.slug) return n;
        const found = findFirstLeaf(n.children);
        if (found) return found;
      }
      return null;
    };

    const firstLeaf = findFirstLeaf(navTree);
    if (firstLeaf?.slug) {
      setSelectedType("module");
      setSelectedService(firstLeaf.topLevelName);
      setSelectedModule(firstLeaf.slug);
    } else if (orgDocs.length > 0) {
      setSelectedType("org-doc");
      setSelectedOrgDoc(orgDocs[0].file_path);
    }
  }, [orgDocs, pages, navTree, searchParams]);

  // Keep expanded state in sync when selecting a module
  useEffect(() => {
    if (selectedService) {
      setExpandedServices((prev) => {
        if (prev.has(selectedService)) return prev;
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

  const selectedServiceSections = useMemo(() => {
    if (selectedType !== "module") return [];
    return extractSectionNav(markdown);
  }, [selectedType, markdown]);

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
          subtitle: "Organization",
          score,
          action: () => handleSelectOrgDoc(doc.file_path),
        });
      }
    });

    pages.forEach((page) => {
      const topName = page.slug.split("/")[0];
      const score = Math.max(
        scoreMatch(page.title),
        scoreMatch(page.slug),
        scoreMatch(topName),
        scoreMatch(page.category ?? "")
      );
      if (score > 0) {
        results.push({
          type: "module",
          title: page.title,
          subtitle: `${topName} / ${page.slug}`,
          preview: page.category ? `Category: ${page.category}` : undefined,
          score,
          action: () => handleSelectModule(topName, page.slug),
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 15);
  }, [searchQuery, orgDocs, pages, handleSelectOrgDoc, handleSelectModule]);

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

            {/* Organization Docs - each shown as its own categorized item */}
            {orgDocs.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 py-1 border-b border-border/40 mb-2">
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Organization</h2>
                </div>
                {[...orgDocs]
                  .sort((a, b) => getOrgDocOrder(a.file_path) - getOrgDocOrder(b.file_path))
                  .map((doc) => {
                    const isSelected = selectedType === "org-doc" && selectedOrgDoc === doc.file_path;
                    const Icon = getOrgDocIcon(doc.file_path);
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
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate font-medium">{getOrgDocDisplayName(doc.file_path)}</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}

            {/* Hierarchical Services / Modules Tree */}
            {navTree.length > 0 && (() => {
              const renderNavTree = (nodes: NavNode[], depth = 0): React.ReactNode =>
                nodes.map((node) => {
                  const isLeaf = !!node.slug;
                  const isSelected = isLeaf && selectedModule === node.slug;
                  const isExpanded = expandedServices.has(node.path);
                  const hasChildren = node.children.length > 0;

                  if (isLeaf) {
                    return (
                      <div key={node.id} className="space-y-0.5">
                        <button
                          onClick={() => handleSelectModule(node.topLevelName, node.slug!)}
                          style={{ paddingLeft: depth > 0 ? `${depth * 12 + 12}px` : undefined }}
                          className={cn(
                            "w-full text-left px-3 py-1.5 rounded-md border transition-colors text-sm",
                            isSelected
                              ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                              : "border-transparent hover:border-border hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                          )}
                        >
                          <span className="truncate block">{node.label}</span>
                        </button>
                        {isSelected && selectedServiceSections.length > 0 && (
                          <div className="ml-6 space-y-0.5 border-l border-border/50 pl-2">
                            {selectedServiceSections.map((section) => (
                              <button
                                key={`${node.id}-${section.id}`}
                                type="button"
                                onClick={() => {
                                  const target = document.getElementById(section.id);
                                  if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
                                }}
                                className={cn(
                                  "w-full text-left text-xs rounded px-2 py-1 hover:bg-muted/60 text-foreground/80",
                                  section.level === 2 && "font-semibold",
                                  section.level === 3 && "pl-4"
                                )}
                              >
                                {section.title}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Folder node
                  const isFolderSelected = selectedService === node.topLevelName && depth === 0;
                  return (
                    <div key={node.id} className="space-y-0.5">
                      <div
                        className={cn(
                          "flex items-center gap-1.5 px-2 py-1.5 rounded-md border transition-colors text-sm cursor-pointer",
                          isFolderSelected && depth === 0
                            ? "border-primary/30 bg-primary/5"
                            : "border-transparent hover:border-border hover:bg-muted/40"
                        )}
                        style={{ paddingLeft: depth > 0 ? `${depth * 12 + 8}px` : undefined }}
                        onClick={() => {
                          if (hasChildren) toggleServiceExpanded(node.path);
                          // Also navigate to first leaf when clicking a top-level folder
                          if (depth === 0 && !isExpanded) {
                            const findFirst = (ns: NavNode[]): NavNode | null => {
                              for (const n of ns) {
                                if (n.slug) return n;
                                const f = findFirst(n.children);
                                if (f) return f;
                              }
                              return null;
                            };
                            const first = findFirst(node.children);
                            if (first?.slug) handleSelectModule(node.topLevelName, first.slug);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="p-0.5 rounded hover:bg-muted/80 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (hasChildren) toggleServiceExpanded(node.path);
                          }}
                          aria-label={isExpanded ? "Collapse" : "Expand"}
                        >
                          {hasChildren ? (
                            isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )
                          ) : null}
                        </button>
                        {isFolderSelected && depth === 0 ? (
                          <FolderOpen className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        ) : (
                          <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate font-medium text-foreground/90">{node.label}</span>
                      </div>

                      {isExpanded && hasChildren && (
                        <div className={cn("space-y-0.5", depth === 0 ? "ml-4 border-l border-border/50 pl-1" : "")}>
                          {renderNavTree(node.children, depth + 1)}
                        </div>
                      )}
                    </div>
                  );
                });

              return (
                <div className="space-y-1">
                  <div className="px-2 py-1 border-b border-border/40 mb-2">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Services</h2>
                  </div>
                  <div className="space-y-0.5">{renderNavTree(navTree)}</div>
                </div>
              );
            })()}

            {orgDocs.length === 0 && navTree.length === 0 && (
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
                      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Organization</p>
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
                        ...sharedMarkdownComponents,
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
                              const topName = slug.split("/")[0];
                              return (
                                <button
                                  type="button"
                                  className="text-primary underline underline-offset-4 hover:opacity-90"
                                  onClick={() => handleSelectModule(topName, slug)}
                                >
                                  {children}
                                </button>
                              );
                            }
                          }
                          if (h.startsWith("code:")) {
                            const filePath = h.slice("code:".length);
                            return (
                              <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                <Code className="h-3 w-3 inline flex-shrink-0" />
                                <code className="text-sm bg-muted/50 px-1 py-0.5 rounded">{filePath}</code>
                              </span>
                            );
                          }
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
            ) : selectedType === "module" && selectedPage ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Service</p>
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
                        ...sharedMarkdownComponents,
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
                              const topName = slug.split("/")[0];
                              return (
                                <button
                                  type="button"
                                  className="text-primary underline underline-offset-4 hover:opacity-90"
                                  onClick={() => handleSelectModule(topName, slug)}
                                >
                                  {children}
                                </button>
                              );
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

