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
import { MermaidBlock } from "@/components/markdown/MermaidBlock";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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

type RepoWithPages = {
  id: number;
  full_name: string;
  pages: WikiPage[];
};

type NavNode = {
  id: string;
  label: string;
  slug?: string;
  path: string;
  children: NavNode[];
  order: number;
  page?: WikiPage;
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

function getRepoShortName(fullName: string): string {
  const parts = fullName.split("/");
  return parts[parts.length - 1] || fullName;
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
  const out: SectionNavItem[] = [];
  const seen = new Set<string>();
  for (const raw of markdown.split("\n")) {
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

async function fetchWikiContent(repoId: number, slug: string, token: string): Promise<string> {
  const presigned = await presignWikiPage(repoId, slug, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) throw new Error("Failed to fetch wiki page");
  return resp.text();
}

async function fetchOrgDocContent(orgId: string, fileName: string, token: string): Promise<string> {
  const presigned = await presignOrgDocument(orgId, fileName, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) throw new Error("Failed to fetch org document");
  return resp.text();
}

export function OrgWikiClient({
  orgId,
  token,
  backHref,
  orgDocs,
  repos,
}: {
  orgId: string;
  token: string;
  backHref: string;
  orgDocs: OrgDoc[];
  repos: RepoWithPages[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [selectedType, setSelectedType] = useState<"org-doc" | "module">("org-doc");
  const [selectedOrgDoc, setSelectedOrgDoc] = useState<string>("");
  const [selectedRepoId, setSelectedRepoId] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRepos, setExpandedRepos] = useState<Set<number>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = sessionStorage.getItem("wiki-org-expanded-repos");
      if (stored) {
        const arr = JSON.parse(stored) as number[];
        return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });
  const [expandedRepoPaths, setExpandedRepoPaths] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = sessionStorage.getItem("wiki-org-expanded-paths");
      if (stored) {
        const arr = JSON.parse(stored) as string[];
        return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set();
  });

  const toggleRepoExpanded = useCallback((repoId: number) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      if (next.has(repoId)) next.delete(repoId);
      else next.add(repoId);
      try {
        sessionStorage.setItem("wiki-org-expanded-repos", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  const toggleRepoPathExpanded = useCallback((pathKey: string) => {
    setExpandedRepoPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      try {
        sessionStorage.setItem("wiki-org-expanded-paths", JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const repoNavTrees = useMemo(() => {
    const normalizeSlug = (slug: string) => slug.replace(/\.(md|mdx)$/i, "");
    const humanize = (s: string) => s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const out = new Map<number, NavNode[]>();
    repos.forEach((repo) => {
      const root: NavNode[] = [];

      repo.pages.forEach((page) => {
        const normalized = normalizeSlug(page.slug);
        const segments = normalized.split("/").filter(Boolean);
        if (segments.length === 0) return;

        let current = root;
        let pathAcc = "";
        segments.forEach((segment, idx) => {
          pathAcc = pathAcc ? `${pathAcc}/${segment}` : segment;
          const isLeaf = idx === segments.length - 1;
          const nodeId = `${repo.id}-${pathAcc}`;
          let node = current.find((n) => n.id === nodeId);

          if (!node) {
            node = {
              id: nodeId,
              label: isLeaf ? page.title || humanize(segment) : humanize(segment),
              slug: isLeaf ? page.slug : undefined,
              path: pathAcc,
              children: [],
              order: isLeaf ? page.nav_order ?? 999 : 0,
              page: isLeaf ? page : undefined,
            };
            current.push(node);
          }

          if (isLeaf) {
            node.label = page.title || humanize(segment);
            node.slug = page.slug;
            node.page = page;
            node.order = page.nav_order ?? 999;
          }
          current = node.children;
        });
      });

      const sortNodes = (nodes: NavNode[]) => {
        nodes.sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          return a.label.localeCompare(b.label);
        });
        nodes.forEach((n) => sortNodes(n.children));
      };
      sortNodes(root);
      out.set(repo.id, root);
    });
    return out;
  }, [repos]);

  const findFirstLeaf = useCallback((nodes: NavNode[]): NavNode | null => {
    for (const node of nodes) {
      if (node.slug) return node;
      const found = findFirstLeaf(node.children);
      if (found) return found;
    }
    return null;
  }, []);

  useEffect(() => {
    const orgDocParam = searchParams?.get("org_doc");
    const repoParam = searchParams?.get("repo");
    const moduleParam = searchParams?.get("module");

    if (orgDocParam && orgDocs.length > 0) {
      const doc = orgDocs.find((d) => d.file_path === orgDocParam);
      if (doc) {
        setSelectedType("org-doc");
        setSelectedOrgDoc(orgDocParam);
        setSelectedRepoId(null);
        setSelectedModule("");
        return;
      }
    }

    if (repoParam && moduleParam) {
      const repoId = parseInt(repoParam, 10);
      const repo = repos.find((r) => r.id === repoId);
      if (repo) {
        const page = repo.pages.find((p) => p.slug === moduleParam);
        if (page) {
          setSelectedType("module");
          setSelectedRepoId(repoId);
          setSelectedModule(moduleParam);
          setSelectedOrgDoc("");
          return;
        }
      }
    }

    if (orgDocs.length > 0) {
      setSelectedType("org-doc");
      setSelectedOrgDoc(orgDocs[0].file_path);
    } else if (repos.length > 0 && repos[0].pages.length > 0) {
      setSelectedType("module");
      setSelectedRepoId(repos[0].id);
      setSelectedModule(repos[0].pages[0].slug);
    }
  }, [orgDocs, repos, searchParams]);

  useEffect(() => {
    if (selectedRepoId) {
      setExpandedRepos((prev) => {
        if (prev.has(selectedRepoId!)) return prev;
        const next = new Set(prev);
        next.add(selectedRepoId!);
        try {
          sessionStorage.setItem("wiki-org-expanded-repos", JSON.stringify([...next]));
        } catch {
          /* ignore */
        }
        return next;
      });
    }
  }, [selectedRepoId]);

  useEffect(() => {
    if (selectedType === "org-doc" && selectedOrgDoc) {
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
    } else if (selectedType === "module" && selectedRepoId && selectedModule) {
      setLoading(true);
      fetchWikiContent(selectedRepoId, selectedModule, token)
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
  }, [selectedType, selectedOrgDoc, selectedRepoId, selectedModule, orgId, token]);

  const handleSelectOrgDoc = useCallback(
    (filePath: string) => {
      setSelectedType("org-doc");
      setSelectedOrgDoc(filePath);
      setSelectedRepoId(null);
      setSelectedModule("");
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("org_id", orgId);
      params.set("org_doc", filePath);
      params.delete("repo");
      params.delete("module");
      router.push(`/wiki?${params.toString()}`, { scroll: false });
    },
    [orgId, router, searchParams]
  );

  const handleSelectModule = useCallback(
    (repoId: number, moduleSlug: string) => {
      setSelectedType("module");
      setSelectedRepoId(repoId);
      setSelectedModule(moduleSlug);
      setSelectedOrgDoc("");
      const params = new URLSearchParams(searchParams?.toString() || "");
      params.set("org_id", orgId);
      params.set("repo", String(repoId));
      params.set("module", moduleSlug);
      params.delete("org_doc");
      router.push(`/wiki?${params.toString()}`, { scroll: false });
    },
    [orgId, router, searchParams]
  );

  const selectedPage = useMemo(() => {
    if (selectedType === "module" && selectedRepoId && selectedModule) {
      const repo = repos.find((r) => r.id === selectedRepoId);
      return repo?.pages.find((p) => p.slug === selectedModule) ?? null;
    }
    return null;
  }, [selectedType, selectedRepoId, selectedModule, repos]);

  const selectedDoc = useMemo(() => {
    if (selectedType === "org-doc" && selectedOrgDoc) {
      return orgDocs.find((d) => d.file_path === selectedOrgDoc) ?? null;
    }
    return null;
  }, [selectedType, selectedOrgDoc, orgDocs]);
  const selectedServiceSections = useMemo(() => {
    if (selectedType !== "module") return [];
    return extractSectionNav(markdown);
  }, [selectedType, markdown]);

  const allPages = useMemo(() => repos.flatMap((r) => r.pages.map((p) => ({ ...p, repoId: r.id, repoName: r.full_name }))), [repos]);

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
    repos.forEach((repo) => {
      const shortName = getRepoShortName(repo.full_name);
      repo.pages.forEach((module) => {
        const score = Math.max(
          scoreMatch(module.title),
          scoreMatch(module.slug),
          scoreMatch(repo.full_name),
          scoreMatch(shortName),
          scoreMatch(module.category ?? "")
        );
        if (score > 0) {
          results.push({
            type: "module",
            title: module.title,
            subtitle: `${shortName} / ${module.slug}`,
            preview: module.category ? `Category: ${module.category}` : undefined,
            score,
            action: () => handleSelectModule(repo.id, module.slug),
          });
        }
      });
    });
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 15);
  }, [searchQuery, orgDocs, repos, handleSelectOrgDoc, handleSelectModule]);

  const markdownComponents = useMemo(
    () => ({
      h2: ({ children, ...props }: any) => {
        const title = String(children);
        const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
        return (
          <h2 id={id} className="scroll-mt-24" {...props}>
            {children}
          </h2>
        );
      },
      h3: ({ children, ...props }: any) => {
        const title = String(children);
        const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
        return (
          <h3 id={id} className="scroll-mt-24" {...props}>
            {children}
          </h3>
        );
      },
      h4: ({ children, ...props }: any) => {
        const title = String(children);
        const id = title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-") || "section";
        return (
          <h4 id={id} className="scroll-mt-24" {...props}>
            {children}
          </h4>
        );
      },
      pre: ({ children, ...props }: any) => {
        const childClass = (props as any)?.children?.props?.className || (Array.isArray(children) && (children as any)[0]?.props?.className) || "";
        const isMermaid = childClass.includes("language-mermaid");
        if (isMermaid) return <div className="not-prose my-6">{children}</div>;
        return (
          <pre {...props} className={cn("not-prose my-4 rounded-md border bg-muted/50 p-4 overflow-x-auto text-sm", (props as any)?.className)}>
            {children}
          </pre>
        );
      },
      code: ({ className, children, ...props }: any) => {
        const text = String(children ?? "").replace(/\n$/, "");
        const match = /language-(\w+)/.exec(className || "");
        if (match?.[1] === "mermaid") return <MermaidBlock code={text} />;
        return <code className={cn("bg-muted/50 px-1.5 py-0.5 rounded text-sm", className)} {...props}>{children}</code>;
      },
      a: ({ href, children, ...props }: any) => {
        const h = href || "";
        if (h.startsWith("wiki:")) {
          const target = h.slice("wiki:".length);
          const withRepo = target.includes("/");
          const [repoPart, slugPart] = withRepo ? target.split("/") : [null, target];
          const slug = slugPart ?? target;
          let pageEntry: { repoId: number; slug: string } | undefined;
          if (repoPart) {
            const repoId = parseInt(repoPart, 10);
            if (!isNaN(repoId)) {
              pageEntry = allPages.find((p) => p.repoId === repoId && p.slug === slug);
            } else {
              const repo = repos.find((r) => getRepoShortName(r.full_name) === repoPart);
              if (repo) pageEntry = allPages.find((p) => p.repoId === repo.id && p.slug === slug);
            }
          }
          if (!pageEntry) {
            pageEntry = allPages.find((p) => p.slug === slug);
          }
          if (pageEntry) {
            return (
              <button
                type="button"
                className="text-primary underline underline-offset-4 hover:opacity-90"
                onClick={() => handleSelectModule(pageEntry!.repoId, slug)}
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
          <a href={h} {...props} target="_blank" rel="noreferrer" className={cn("underline underline-offset-4 hover:opacity-90", isCodeLink ? "text-blue-600 dark:text-blue-400 inline-flex items-center gap-1" : "text-primary")}>
            {isCodeLink && <Code className="h-3 w-3 inline flex-shrink-0" />}
            {children}
            {isCodeLink && <ExternalLink className="h-3 w-3 inline flex-shrink-0 opacity-50" />}
          </a>
        );
      },
    }),
    [allPages, handleSelectModule, repos]
  );

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
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
                <h1 className="text-xl font-semibold">Organization Knowledge Base</h1>
              </div>
            </div>
          </div>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="w-40 justify-start text-muted-foreground">
                <Search className="mr-2 h-4 w-4" />
                Search...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="p-2">
                <Input placeholder="Search pages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8" autoFocus />
              </div>
              {searchQuery && (
                <div className="max-h-60 overflow-y-auto border-t">
                  {filteredPages.length > 0 ? (
                    <div className="p-1">
                      {filteredPages.map((item, idx) => (
                        <button key={idx} className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted rounded-sm flex flex-col gap-0.5" onClick={() => { item.action(); setSearchOpen(false); }}>
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

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r bg-background/95 overflow-y-auto">
          <div className="p-4 space-y-4">
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
                  <p className="text-xs text-muted-foreground">Last indexed: {date.toLocaleDateString()}</p>
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

            {repos.length > 0 && (
              <div className="space-y-2">
                <div className="px-2 py-1">
                  <h2 className="text-sm font-semibold text-foreground">Services</h2>
                </div>
                <div className="space-y-1">
                  {repos.map((repo) => {
                    const isRepoSelected = selectedRepoId === repo.id;
                    const tree = repoNavTrees.get(repo.id) || [];
                    const hasPages = tree.length > 0;
                    const isExpanded = expandedRepos.has(repo.id);
                    const shortName = getRepoShortName(repo.full_name);

                    const renderRepoTree = (nodes: NavNode[], depth = 0): React.ReactNode =>
                      nodes.map((node) => {
                        const pathKey = `${repo.id}:${node.path}`;
                        const hasChildren = node.children.length > 0;
                        const isPathExpanded = expandedRepoPaths.has(pathKey);
                        const isLeaf = !!node.slug;
                        const isLeafSelected = isLeaf && selectedRepoId === repo.id && selectedModule === node.slug;

                        if (isLeaf) {
                          return (
                            <div key={node.id} className="space-y-0.5">
                              <button
                                onClick={() => handleSelectModule(repo.id, node.slug!)}
                                style={{ paddingLeft: depth > 0 ? `${depth * 12 + 12}px` : undefined }}
                                className={cn(
                                  "w-full text-left px-3 py-2 rounded-md border transition-colors text-sm",
                                  isLeafSelected
                                    ? "border-primary/70 bg-primary/10 text-primary shadow-sm"
                                    : "border-transparent hover:border-border hover:bg-muted/70 text-foreground/80 hover:text-foreground"
                                )}
                              >
                                <span className="truncate">{node.label}</span>
                              </button>
                              {isLeafSelected && selectedServiceSections.length > 0 && (
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

                        return (
                          <div key={node.id} className="space-y-1">
                            <div
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-sm cursor-pointer",
                                "border-transparent hover:border-border hover:bg-muted/40"
                              )}
                              style={{ paddingLeft: depth > 0 ? `${depth * 12 + 8}px` : undefined }}
                              onClick={() => hasChildren && toggleRepoPathExpanded(pathKey)}
                            >
                              <button
                                type="button"
                                className="p-0.5 -m-0.5 rounded hover:bg-muted/80 flex-shrink-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasChildren) toggleRepoPathExpanded(pathKey);
                                }}
                                aria-label={isPathExpanded ? "Collapse" : "Expand"}
                              >
                                {hasChildren ? (
                                  isPathExpanded ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )
                                ) : null}
                              </button>
                              <Folder className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                              <span className="flex-1 truncate font-medium text-foreground/90">{node.label}</span>
                            </div>
                            {isPathExpanded && hasChildren && (
                              <div className={cn("space-y-1", depth === 0 ? "ml-4 border-l border-border/50 pl-1" : "")}>
                                {renderRepoTree(node.children, depth + 1)}
                              </div>
                            )}
                          </div>
                        );
                      });

                    return (
                      <div key={repo.id} className="space-y-1">
                        <div
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-md border transition-colors text-sm cursor-pointer",
                            isRepoSelected ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-border hover:bg-muted/50"
                          )}
                          onClick={() => {
                            if (!hasPages) return;
                            const firstLeaf = findFirstLeaf(tree);
                            if (firstLeaf?.slug) handleSelectModule(repo.id, firstLeaf.slug);
                          }}
                        >
                          <button
                            type="button"
                            className="p-0.5 -m-0.5 rounded hover:bg-muted/80 flex-shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasPages) toggleRepoExpanded(repo.id);
                            }}
                            aria-label={isExpanded ? "Collapse" : "Expand"}
                          >
                            {hasPages ? (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />) : null}
                          </button>
                          {isRepoSelected ? <FolderOpen className="h-4 w-4 text-primary flex-shrink-0" /> : <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                          <span className="flex-1 truncate font-medium">{shortName}</span>
                        </div>
                        {isExpanded && hasPages && (
                          <div className="ml-6 space-y-1 border-l border-border/60 pl-2">
                            {renderRepoTree(tree)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {orgDocs.length === 0 && repos.length === 0 && (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <p>No content available.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="max-w-4xl mx-auto px-8 py-8">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Loader className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedType === "org-doc" && selectedDoc ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Organization</p>
                    <h1 className="text-3xl font-bold leading-tight">{getOrgDocDisplayName(selectedDoc.file_path)}</h1>
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {markdown}
                    </ReactMarkdown>
                  </article>
                </div>
              </div>
            ) : selectedType === "module" && selectedPage ? (
              <div className="space-y-6">
                <div className="rounded-xl border bg-card/80 backdrop-blur shadow-sm p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Service</p>
                    <h1 className="text-3xl font-bold leading-tight">{selectedPage.title}</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedRepoId && getRepoShortName(repos.find((r) => r.id === selectedRepoId)?.full_name ?? "")} / {selectedPage.slug}
                    </p>
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
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

        <aside className="hidden lg:block w-64 border-l bg-background/95 overflow-y-auto">
          <div className="p-6">
            {(selectedType === "module" || selectedType === "org-doc") && markdown && <TableOfContents markdown={markdown} />}
          </div>
        </aside>
      </div>
    </div>
  );
}
