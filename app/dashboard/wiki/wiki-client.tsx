"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  MessageCircle,
  X,
  Send,
  Loader2,
} from "lucide-react";
import { presignOrgDocument, presignWikiPage, chatStream } from "@/lib/api/backend-client";
import { cn } from "@/lib/utils";

type WikiPage = { id: number; slug: string; title: string; category: string };
type Repo = { id: number; full_name: string; default_branch: string; wiki_pages: WikiPage[] };
type Capability = { id: string; name: string; level: number; parent_capability_id?: string; children: any[]; services: { repository_id: number }[] };

type Props = {
  orgId: string;
  wikiData: {
    org_documents: any[];
    repositories: Repo[];
    capabilities: Capability[];
  } | null;
  token: string;
  initialRepoId?: number;
};

type NavSelection = { type: "org"; fileName: string } | { type: "wiki"; repoId: number; slug: string };
type ChatMessage = { role: "user" | "assistant"; content: string };

export function WikiClient({ orgId, wikiData, token, initialRepoId }: Props) {
  const orgDocs = useMemo(() => wikiData?.org_documents || [], [wikiData]);
  const repos = useMemo(() => wikiData?.repositories || [], [wikiData]);
  const capabilities = useMemo(() => wikiData?.capabilities || [], [wikiData]);

  const [selected, setSelected] = useState<NavSelection | null>(null);
  const [content, setContent] = useState<string>("");
  const [loadingContent, setLoadingContent] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCaps, setExpandedCaps] = useState<Set<string>>(new Set());
  const [expandedRepos, setExpandedRepos] = useState<Set<number>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-select initial repo's first page
  useEffect(() => {
    if (initialRepoId) {
      const repo = repos.find((r) => r.id === initialRepoId);
      if (repo && repo.wiki_pages.length > 0) {
        setSelected({ type: "wiki", repoId: repo.id, slug: repo.wiki_pages[0].slug });
        // Expand the capability that contains this repo
        for (const cap of capabilities) {
          if (cap.services?.some((s) => s.repository_id === repo.id)) {
            setExpandedCaps(new Set([cap.id]));
            break;
          }
        }
        setExpandedRepos(new Set([repo.id]));
      }
    }
  }, [initialRepoId, repos, capabilities]);

  // Fetch content when selection changes
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingContent(true);

    (async () => {
      try {
        if (selected.type === "org") {
          const presigned = await presignOrgDocument(orgId, selected.fileName, token);
          const resp = await fetch(presigned.url, { cache: "no-store" });
          if (!cancelled) setContent(resp.ok ? await resp.text() : "Failed to load document");
        } else {
          const presigned = await presignWikiPage(selected.repoId, selected.slug, token);
          const resp = await fetch(presigned.url, { cache: "no-store" });
          if (!cancelled) setContent(resp.ok ? await resp.text() : "Failed to load page");
        }
      } catch {
        if (!cancelled) setContent("Error loading content");
      } finally {
        if (!cancelled) setLoadingContent(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selected, orgId, token]);

  const toggleCap = (id: string) => {
    setExpandedCaps((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleRepo = (id: number) => {
    setExpandedRepos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Build capability -> repo mapping
  const reposByCapability = useMemo(() => {
    const map: Record<string, Repo[]> = {};
    for (const cap of capabilities) {
      if (!cap.services) continue;
      map[cap.id] = cap.services
        .map((s) => repos.find((r) => r.id === s.repository_id))
        .filter(Boolean) as Repo[];
    }
    return map;
  }, [capabilities, repos]);

  // Root capabilities (no parent)
  const rootCaps = capabilities.filter((c) => !c.parent_capability_id);

  const getRepoName = (fullName: string) => fullName?.split("/").pop() || fullName;

  const filteredOrgDocs = orgDocs.filter((d: any) =>
    !searchTerm || d.file_path?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // TOC generation from content
  const headings = useMemo(() => {
    if (!content) return [];
    const lines = content.split("\n");
    return lines
      .filter((l) => /^#{1,3}\s/.test(l))
      .map((l) => {
        const match = l.match(/^(#{1,3})\s+(.+)/);
        if (!match) return null;
        return { level: match[1].length, text: match[2], id: match[2].toLowerCase().replace(/[^a-z0-9]+/g, "-") };
      })
      .filter(Boolean) as { level: number; text: string; id: string }[];
  }, [content]);

  // Chat
  const selectedRepoId = selected?.type === "wiki" ? selected.repoId : undefined;

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    const newMessages: ChatMessage[] = [...chatMessages, { role: "user", content: userMsg }];
    setChatMessages(newMessages);
    setChatLoading(true);

    try {
      const resp = await chatStream(token, {
        query: userMsg,
        repo_ids: selectedRepoId ? [selectedRepoId] : undefined,
        history: newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      });

      const reader = resp.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let assistantContent = "";

      setChatMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "token") {
              assistantContent += parsed.content;
              setChatMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: "assistant", content: assistantContent };
                return copy;
              });
            }
          } catch {}
        }
      }
    } catch (e: any) {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "Sorry, an error occurred." }]);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, selectedRepoId, token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  function renderCapTree(caps: Capability[], depth = 0) {
    return caps.map((cap) => {
      const childCaps = capabilities.filter((c) => c.parent_capability_id === cap.id);
      const capRepos = reposByCapability[cap.id] || [];
      const isOpen = expandedCaps.has(cap.id);

      if (searchTerm) {
        const matchesCap = cap.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesChild = capRepos.some((r) =>
          getRepoName(r.full_name).toLowerCase().includes(searchTerm.toLowerCase()) ||
          r.wiki_pages.some((p) => p.title.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        if (!matchesCap && !matchesChild && childCaps.length === 0) return null;
      }

      return (
        <div key={cap.id} style={{ paddingLeft: depth * 8 }}>
          <button
            onClick={() => toggleCap(cap.id)}
            className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
            {isOpen ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" /> : <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <span className="font-medium truncate">{cap.name}</span>
          </button>
          <div className={cn("overflow-hidden transition-all duration-200", isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0")}>
            {childCaps.length > 0 && renderCapTree(childCaps, depth + 1)}
            {capRepos.map((repo) => {
              const repoOpen = expandedRepos.has(repo.id);
              return (
                <div key={repo.id} style={{ paddingLeft: (depth + 1) * 8 }}>
                  <button
                    onClick={() => toggleRepo(repo.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    {repoOpen ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                    <span className="truncate">{getRepoName(repo.full_name)}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{repo.wiki_pages.length}</Badge>
                  </button>
                  <div className={cn("overflow-hidden transition-all duration-200", repoOpen ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
                    {repo.wiki_pages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => setSelected({ type: "wiki", repoId: repo.id, slug: page.slug })}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent transition-colors",
                          selected?.type === "wiki" && selected.repoId === repo.id && selected.slug === page.slug && "bg-primary/10 text-primary font-medium"
                        )}
                        style={{ paddingLeft: (depth + 2) * 8 + 8 }}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    });
  }

  return (
    <div className="flex h-[calc(100vh-7.5rem)] -m-6 relative">
      {/* Left Nav */}
      <div className="w-72 shrink-0 border-r overflow-y-auto p-3 space-y-1">
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search pages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        {/* Org Docs */}
        {filteredOrgDocs.length > 0 && (
          <div>
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Organization</div>
            {filteredOrgDocs.map((doc: any) => {
              const fileName = doc.file_path?.split("/").pop() || doc.file_path;
              const label = fileName?.replace(/\.(md|txt)$/, "").replace(/[_-]/g, " ");
              return (
                <button
                  key={doc.id}
                  onClick={() => setSelected({ type: "org", fileName })}
                  className={cn(
                    "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors",
                    selected?.type === "org" && selected.fileName === fileName && "bg-primary/10 text-primary font-medium"
                  )}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate capitalize">{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Capabilities Tree */}
        {rootCaps.length > 0 && (
          <div className="pt-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Capabilities</div>
            {renderCapTree(rootCaps)}
          </div>
        )}

        {/* Repos without capability (fallback, shouldn't happen with new flow) */}
        {repos.filter((r) => !capabilities.some((c) => c.services?.some((s) => s.repository_id === r.id))).length > 0 && (
          <div className="pt-2">
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Services</div>
            {repos
              .filter((r) => !capabilities.some((c) => c.services?.some((s) => s.repository_id === r.id)))
              .map((repo) => (
                <div key={repo.id}>
                  <button
                    onClick={() => toggleRepo(repo.id)}
                    className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                  >
                    {expandedRepos.has(repo.id) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <span className="truncate">{getRepoName(repo.full_name)}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">{repo.wiki_pages.length}</Badge>
                  </button>
                  <div className={cn("overflow-hidden transition-all duration-200", expandedRepos.has(repo.id) ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0")}>
                    {repo.wiki_pages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => setSelected({ type: "wiki", repoId: repo.id, slug: page.slug })}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-accent transition-colors pl-7",
                          selected?.type === "wiki" && selected.repoId === repo.id && selected.slug === page.slug && "bg-primary/10 text-primary font-medium"
                        )}
                      >
                        <FileText className="h-3 w-3 shrink-0" />
                        <span className="truncate">{page.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <FileText className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">Select a page from the sidebar</p>
            <p className="text-sm mt-1">Browse your documentation by capability and service</p>
          </div>
        )}

        {selected && loadingContent && (
          <div className="space-y-4 animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="h-4 bg-muted rounded w-1/2" />
            <div className="h-32 bg-muted rounded" />
          </div>
        )}

        {selected && !loadingContent && content && (
          <article className="prose prose-slate dark:prose-invert max-w-none animate-in fade-in duration-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </article>
        )}
      </div>

      {/* TOC */}
      {headings.length > 2 && (
        <div className="hidden xl:block w-56 shrink-0 border-l overflow-y-auto p-4">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">On this page</div>
          <nav className="space-y-1">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={cn(
                  "block text-sm text-muted-foreground hover:text-foreground transition-colors truncate",
                  h.level === 1 && "font-medium text-foreground",
                  h.level === 2 && "pl-3",
                  h.level === 3 && "pl-6 text-xs"
                )}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </div>
      )}

      {/* Floating Chat Widget */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 flex items-center gap-2 rounded-2xl bg-card/80 backdrop-blur-sm border shadow-lg px-4 py-3 hover:scale-105 transition-transform z-40"
        >
          <MessageCircle className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Ask about your code</span>
        </button>
      )}

      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-0 right-0 top-14 w-[400px] bg-card border-l shadow-2xl z-40 flex flex-col transition-all duration-300",
          chatOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="font-semibold">Ask about your code</div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setChatOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {chatMessages.length === 0 && (
            <div className="text-center text-muted-foreground py-8 space-y-3">
              <p className="text-sm">Ask questions about your codebase</p>
              {selectedRepoId && (
                <Badge variant="secondary">Scoped to current service</Badge>
              )}
              <div className="space-y-2">
                {["How does this service handle errors?", "What are the main dependencies?", "Explain the API endpoints"].map((q) => (
                  <button
                    key={q}
                    onClick={() => { setChatInput(q); }}
                    className="block w-full text-left text-sm rounded-lg border px-3 py-2 hover:bg-accent transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || "..."}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask about this code..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendChat()}
              disabled={chatLoading}
              className="flex-1"
            />
            <Button size="icon" onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}>
              {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
