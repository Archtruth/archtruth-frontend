"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, User, Bot, FileText, Loader2 } from "lucide-react";
import { chatStream, backendFetch } from "@/lib/api/backend-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Citation = { doc_id?: number; repo_id?: number; file_path?: string; commit_sha?: string; score?: number; similarity?: number };

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  id: string;
};

type Org = { id: string; name: string };
type Repo = { id: number; full_name: string };

export function ChatClient({
  token,
  initialOrgs,
  initialReposByOrg = {},
}: {
  token: string;
  initialOrgs: Org[];
  initialReposByOrg?: Record<string, Repo[]>;
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgs] = useState<Org[]>(initialOrgs || []);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>(initialOrgs?.[0]?.id);
  const [reposByOrg, setReposByOrg] = useState<Record<string, Repo[]>>(initialReposByOrg);
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    async function loadRepos(orgId: string) {
      if (!orgId || reposByOrg[orgId]) return;
      setLoadingRepos(true);
      try {
        const resp = await backendFetch<{ repositories: Repo[] }>(`/orgs/${orgId}/repositories`, token);
        setReposByOrg((prev) => ({ ...prev, [orgId]: resp.repositories || [] }));
      } catch (e) {
        console.error("Failed to load repositories", e);
      } finally {
        setLoadingRepos(false);
      }
    }
    if (selectedOrgId) {
      loadRepos(selectedOrgId);
    }
  }, [selectedOrgId, reposByOrg, token]);

  const send = async () => {
    if (!token || !query.trim()) return;
    if (!selectedOrgId || selectedRepoIds.length === 0) {
      setError("Select an org and at least one repository.");
      return;
    }
    
    const currentQuery = query.trim();
    setQuery("");
    setLoading(true);
    setError(null);
    
    const userMsg: Message = { role: "user", content: currentQuery, id: Date.now().toString() };
    const botMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", id: botMsgId }]);

    const controller = new AbortController();
    abortRef.current = controller;

    const history = messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const resp = await chatStream(
        token,
        { query: currentQuery, history, repo_ids: selectedRepoIds },
        controller.signal
      );
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      let currentText = "";
      let currentCitations: Citation[] = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        
        for (const part of parts) {
          if (!part.startsWith("data:")) continue;
          const payload = part.replace(/^data:\s*/, "");
          try {
            const obj = JSON.parse(payload);
            if (obj.event === "context") {
              currentCitations = obj.citations || [];
              setMessages((prev) => 
                prev.map(m => m.id === botMsgId ? { ...m, citations: currentCitations } : m)
              );
            } else if (obj.event === "chunk") {
              currentText += obj.text;
               setMessages((prev) => 
                prev.map(m => m.id === botMsgId ? { ...m, content: currentText } : m)
              );
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setError(e?.message || "Chat failed");
        setMessages((prev) => prev.slice(0, -1)); // Remove the empty bot message on error
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-h-[800px] min-h-[500px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Chat with your Codebase</h1>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Organization</label>
          <Select
            value={selectedOrgId}
            onValueChange={(val) => {
              setSelectedOrgId(val);
              setSelectedRepoIds([]);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select org" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Repositories (select at least one)</label>
          <Select
            value={selectedRepoIds[0]?.toString() || ""}
            onValueChange={(val) => {
              const id = Number(val);
              setSelectedRepoIds(id ? [id] : []);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingRepos ? "Loading repos..." : "Select repository"} />
            </SelectTrigger>
            <SelectContent>
              {(selectedOrgId ? reposByOrg[selectedOrgId] || [] : []).map((repo) => (
                <SelectItem key={repo.id} value={repo.id.toString()}>
                  {repo.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedOrgId && <p className="text-xs text-mutedForeground">Pick an org first.</p>}
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-md">
        <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-mutedForeground opacity-50">
               <Bot className="w-16 h-16 mb-4" />
               <p>Ask a question about your connected repositories.</p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex gap-3",
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                )}
              >
                <Avatar className={cn("h-8 w-8", m.role === "assistant" ? "bg-primary" : "bg-muted")}>
                   {m.role === "user" ? (
                      <AvatarImage src="" />
                   ) : null}
                   <AvatarFallback className={m.role === "assistant" ? "bg-primary text-primary-foreground" : ""}>
                     {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                   </AvatarFallback>
                </Avatar>

                <div className={cn(
                    "flex flex-col max-w-[80%]",
                    m.role === "user" ? "items-end" : "items-start"
                )}>
                    <div
                      className={cn(
                        "rounded-lg px-4 py-2 text-sm shadow-sm",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                      ) : (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                      )}
                    </div>
                    {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 text-xs text-mutedForeground bg-muted/50 p-2 rounded border border-border w-full">
                            <div className="font-semibold mb-1 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Sources
                            </div>
                            <ul className="space-y-1">
                                {m.citations.map((c, i) => (
                                    <li key={i} className="truncate" title={c.file_path}>
                                        {c.file_path}{" "}
                                        {c.commit_sha ? (
                                          <span className="opacity-60 font-mono">[{c.commit_sha.slice(0,7)}]</span>
                                        ) : null}{" "}
                                        {c.score !== undefined || c.similarity !== undefined ? (
                                          <span className="opacity-50">
                                            ({(c.score ?? c.similarity ?? 0).toFixed(2)})
                                          </span>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
              </div>
            ))
          )}
          {loading && (
             <div className="flex gap-3">
                 <Avatar className="h-8 w-8 bg-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                    </AvatarFallback>
                 </Avatar>
                 <div className="bg-muted text-foreground rounded-lg px-4 py-2 text-sm shadow-sm flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Thinking...
                 </div>
             </div>
          )}
          {error && <div className="text-center text-sm text-destructive my-2">{error}</div>}
        </div>

        <div className="p-4 bg-background border-t">
          <div className="flex gap-2">
            <Input
              placeholder="Ask a question..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={send} disabled={loading || !query.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
