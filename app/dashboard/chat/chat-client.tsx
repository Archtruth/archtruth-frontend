"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, User, Bot, FileText, Loader2, AlertTriangle } from "lucide-react";
import { chatStream, backendFetch } from "@/lib/api/backend-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MermaidBlock } from "@/components/markdown/MermaidBlock";

type Citation = {
  doc_id?: number;
  repo_id?: number;
  file_path?: string;
  commit_sha?: string;
  url?: string | null;
  score?: number;
  similarity?: number;
  heading?: string;
  chunk_index?: number;
  start_offset?: number;
  end_offset?: number;
  snippet?: string;
};

type ToolResult = {
  tool: string;
  query?: string;
  result_count?: number;
  summary: string;
  preview?: string;
};

type Message = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  id: string;
  statusMessages?: string[];
  currentStatus?: string;
  showStatusDetails?: boolean;
  toolResults?: ToolResult[];
  error?: string;
  isError?: boolean;
};

type Repo = { id: number; full_name: string };

export function ChatClient({
  token,
  orgId,
  initialRepos,
}: {
  token: string;
  orgId: string;
  initialRepos: Repo[];
}) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingStartTime, setStreamingStartTime] = useState<number | null>(null);
  const [repos, setRepos] = useState<Repo[]>(initialRepos);
  const [selectedRepoIds, setSelectedRepoIds] = useState<number[]>(initialRepos.map((r) => r.id));
  const [allReposSelected, setAllReposSelected] = useState<boolean>(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reset state when org changes
  useEffect(() => {
    setRepos(initialRepos);
    setSelectedRepoIds(initialRepos.map((r) => r.id));
    setAllReposSelected(true);
    setMessages([]);
    setError(null);
  }, [orgId, initialRepos]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async () => {
    if (!token || !query.trim()) return;
    if (selectedRepoIds.length === 0) {
      setError("Select at least one repository.");
      return;
    }
    
    const currentQuery = query.trim();
    setQuery("");
    setLoading(true);
    setError(null);
    
    const userMsg: Message = { role: "user", content: currentQuery, id: Date.now().toString() };
    const botMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, userMsg, { role: "assistant", content: "", id: botMsgId }]);
    setStreamingStartTime(Date.now());

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
            } else if (obj.event === "status") {
              let message = obj.message || obj.phase || "Working...";

              // Make status messages more user-friendly
              if (message.includes("Setting up research strategy")) {
                message = "Analyzing your complex question and planning research approach...";
              } else if (message.includes("Gathering initial evidence")) {
                message = "Collecting relevant information from documentation and code...";
              } else if (message.includes("Found relevant information")) {
                message = "Analyzing gathered information and building understanding...";
              } else if (message.includes("Starting research")) {
                message = "Beginning detailed research and investigation...";
              } else if (message.includes("Gathering more details")) {
                message = "Finding additional details and connections...";
              } else if (message.includes("Refining analysis")) {
                message = "Refining the analysis with deeper investigation...";
              } else if (message.includes("Time budget reached")) {
                message = "Completing comprehensive analysis with findings...";
              } else if (message.includes("Providing comprehensive partial analysis")) {
                message = "Finalizing detailed findings and next steps...";
              } else if (message.includes("synthesis")) {
                message = "Synthesizing comprehensive answer from all evidence...";
              }

              setMessages((prev) =>
                prev.map(m => m.id === botMsgId
                  ? (() => {
                      const prevLog = m.statusMessages || [];
                      const msg = String(message);
                      // De-dupe consecutive duplicates and cap log size for a cleaner UI.
                      const last = prevLog.length > 0 ? prevLog[prevLog.length - 1] : null;
                      const nextLog = last === msg ? prevLog : [...prevLog, msg].slice(-15); // Reduced from 20 to 15
                      return { ...m, currentStatus: msg, statusMessages: nextLog };
                    })()
                  : m)
              );
            } else if (obj.event === "tool_result") {
              const toolResult: ToolResult = {
                tool: obj.tool,
                query: obj.query,
                result_count: obj.result_count,
                summary: obj.summary,
                preview: obj.preview
              };
              setMessages((prev) =>
                prev.map(m => m.id === botMsgId
                  ? { ...m, toolResults: [...(m.toolResults || []), toolResult] }
                  : m)
              );
            } else if (obj.event === "error") {
              const errorMessage = obj.message || "The assistant encountered an error while processing your request.";
              setMessages((prev) =>
                prev.map(m => m.id === botMsgId ? {
                  ...m,
                  content: errorMessage,
                  error: errorMessage,
                  isError: true,
                  currentStatus: undefined,
                  statusMessages: undefined
                } : m)
              );
              setError(null); // Clear global error since it's handled in the message
            }
          } catch {
            // ignore parse errors
          }
        }
      }

      // Check for timeout (30 seconds)
      const checkTimeout = () => {
        if (streamingStartTime && Date.now() - streamingStartTime > 30000) {
          controller.abort();
          const timeoutMessage = "Request timed out. The server may be experiencing high load. Please try again.";
          setMessages((prev) =>
            prev.map(m => m.id === botMsgId ? {
              ...m,
              content: timeoutMessage,
              error: timeoutMessage,
              isError: true,
              currentStatus: undefined,
              statusMessages: undefined
            } : m)
          );
        }
      };

      const timeoutId = setTimeout(checkTimeout, 31000); // Check slightly after 30s

      clearTimeout(timeoutId); // Clear timeout when done

    } catch (e: any) {
      if (e?.name !== "AbortError") {
        const errorMessage = e?.message || "Failed to send message. Please check your connection and try again.";
        setMessages((prev) =>
          prev.map(m => m.id === botMsgId ? {
            ...m,
            content: errorMessage,
            error: errorMessage,
            isError: true,
            currentStatus: undefined,
            statusMessages: undefined
          } : m)
        );
        setError(null); // Clear global error since it's handled in the message
      }
    } finally {
      setLoading(false);
      setStreamingStartTime(null);
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
        <div>
          <h1 className="text-2xl font-semibold">Chat with your Codebase</h1>
          <p className="text-sm text-mutedForeground mt-1">
            Organization scoped to your selection in the header
          </p>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Repositories (defaults to all)</label>
          <div className="rounded-md border border-border/60 p-3 bg-muted/40 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={allReposSelected}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAllReposSelected(checked);
                  if (checked) {
                    setSelectedRepoIds(repos.map((r) => r.id));
                  } else {
                    setSelectedRepoIds([]);
                  }
                }}
              />
              <span className="text-sm">All repositories in org</span>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {repos.map((repo) => {
                const checked = selectedRepoIds.includes(repo.id);
                return (
                  <label key={repo.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const val = e.target.checked;
                        setAllReposSelected(false);
                        setSelectedRepoIds((prev) =>
                          val ? Array.from(new Set([...prev, repo.id])) : prev.filter((id) => id !== repo.id)
                        );
                      }}
                    />
                    <span className="truncate">{repo.full_name}</span>
                  </label>
                );
              })}
              {repos.length === 0 && (
                <p className="text-xs text-mutedForeground">No repos found for this organization.</p>
              )}
            </div>
          </div>
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
                          : m.isError
                          ? "bg-destructive/10 text-destructive border border-destructive/20"
                          : "bg-muted text-foreground"
                      )}
                    >
                      {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown
                              components={{
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
                              {m.content}
                            </ReactMarkdown>
                          </div>
                      ) : (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                      )}

                      {m.isError && m.role === "assistant" && (
                        <div className="mt-2 flex items-center gap-2">
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-destructive/20 hover:border-destructive/40"
                            onClick={() => {
                              // Find the corresponding user message and retry
                              const userMessageIndex = messages.findIndex(msg => msg.role === "user" && msg.id === String(parseInt(m.id) - 1));
                              if (userMessageIndex >= 0) {
                                const userMessage = messages[userMessageIndex];
                                // Remove error message and retry
                                setMessages(prev => prev.filter(msg => msg.id !== m.id));
                                // Retry with the original query
                                const originalQuery = userMessage.content;
                                setQuery(originalQuery);
                                setTimeout(() => send(), 100); // Small delay to ensure state updates
                              }
                            }}
                          >
                            🔄 Retry
                          </Button>
                          <span className="text-xs text-muted-foreground">Message failed to send</span>
                        </div>
                      )}
                    </div>
                    {m.citations && m.citations.length > 0 && (
                        <div className="mt-2 text-xs text-mutedForeground bg-muted/50 p-2 rounded border border-border w-full">
                            <div className="font-semibold mb-1 flex items-center gap-1">
                                <FileText className="h-3 w-3" /> Sources ({m.citations.length})
                            </div>
                            <div className="space-y-2">
                                {m.citations.slice(0, 5).map((c, i) => (
                                    <div key={i} className="bg-white dark:bg-muted/30 p-2 rounded border">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-foreground truncate" title={c.file_path}>
                                                    {c.url ? (
                                                      <a
                                                        href={c.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="underline underline-offset-2 hover:text-foreground"
                                                      >
                                                        {c.file_path}
                                                      </a>
                                                    ) : (
                                                      <span>{c.file_path}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
                                                    {c.commit_sha && (
                                                      <span className="font-mono">[{c.commit_sha.slice(0,7)}]</span>
                                                    )}
                                                    {c.start_offset !== undefined && c.end_offset !== undefined && (
                                                      <span className="font-mono">lines {c.start_offset}-{c.end_offset}</span>
                                                    )}
                                                    {(c.score !== undefined || c.similarity !== undefined) && (
                                                      <span>
                                                        relevance: {(c.score ?? c.similarity ?? 0).toFixed(2)}
                                                      </span>
                                                    )}
                                                </div>
                                            </div>
                                            {c.heading && (
                                                <div className="text-xs opacity-70 flex-shrink-0">
                                                    {c.heading}
                                                </div>
                                            )}
                                        </div>
                                        {c.snippet && (
                                            <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                                                <div className="truncate" title={c.snippet}>
                                                    {c.snippet.length > 150 ? c.snippet.slice(0, 150) + "..." : c.snippet}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {m.citations.length > 5 && (
                                    <div className="text-center text-xs opacity-60">
                                        ... and {m.citations.length - 5} more sources
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {m.toolResults && m.toolResults.length > 0 && (
                      <div className="mt-2 text-xs text-mutedForeground bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800 w-full">
                        <div className="font-semibold mb-2 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Research Findings
                        </div>
                        <div className="space-y-2">
                          {m.toolResults.map((result, i) => (
                            <div key={i} className="bg-white dark:bg-muted/30 p-2 rounded border">
                              <div className="font-medium text-foreground text-xs">{result.summary}</div>
                              {result.preview && (
                                <div className="mt-1 text-xs opacity-80 italic">
                                  &ldquo;{result.preview}&rdquo;
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.currentStatus ? (
                      <div className="mt-2 text-xs text-mutedForeground bg-muted/40 p-2 rounded border border-dashed w-full">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate">
                            <span className="font-semibold">Working:</span>{" "}
                            <span className="opacity-90">{m.currentStatus}</span>
                          </div>
                          {m.statusMessages && m.statusMessages.length > 1 ? (
                            <button
                              type="button"
                              className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                              onClick={() => {
                                setMessages((prev) =>
                                  prev.map(x => x.id === m.id ? { ...x, showStatusDetails: !x.showStatusDetails } : x)
                                );
                              }}
                            >
                              {m.showStatusDetails ? "Hide" : "Details"}
                            </button>
                          ) : null}
                        </div>
                        {m.showStatusDetails && m.statusMessages && m.statusMessages.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {m.statusMessages.map((s, i) => (
                              <li key={i} className="truncate">{s}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
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
                    {streamingStartTime && Date.now() - streamingStartTime > 10000
                      ? "Taking a bit longer... Analyzing your complex query"
                      : streamingStartTime && Date.now() - streamingStartTime > 5000
                      ? "Searching documentation and code..."
                      : "Thinking..."}
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
