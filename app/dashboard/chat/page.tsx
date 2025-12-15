import { Suspense } from "react";
import { getServerSession } from "@/lib/supabase/server";
import { ChatClient } from "./chat-client";

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      {/* @ts-expect-error Async Server Component */}
      <ChatPageInner />
    </Suspense>
  );
}

async function ChatPageInner() {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    return <div>Please sign in to chat.</div>;
  }
  return <ChatClient token={token} />;
}
"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { getServerSession } from "@/lib/supabase/server";
import { chatStream } from "@/lib/api/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Citation = { doc_id?: number; file_path?: string; similarity?: number };

async function ChatPageInner() {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    return <div>Please sign in to chat.</div>;
  }
  return <ChatClient token={token} />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      {/* @ts-expect-error Async Server Component */}
      <ChatPageInner />
    </Suspense>
  );
}

function ChatClient({ token }: { token: string }) {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = async () => {
    if (!token || !query) return;
    setLoading(true);
    setMessages([]);
    setCitations([]);
    const controller = new AbortController();
    abortRef.current = controller;
    const resp = await chatStream(token, { query });
    const reader = resp.body?.getReader();
    if (!reader) {
      setLoading(false);
      return;
    }
    const decoder = new TextDecoder();
    let buffer = "";
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
            setCitations(obj.citations || []);
          } else if (obj.event === "chunk") {
            setMessages((m) => [...m, obj.text]);
          }
        } catch {
          // ignore parse errors
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chat</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Ask about your docs..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
            />
            <Button onClick={send} disabled={loading || !query}>
              Send
            </Button>
          </div>
          <div className="border rounded-md p-3 min-h-[120px] whitespace-pre-wrap">
            {messages.length === 0 ? "Awaiting response..." : messages.join("")}
          </div>
          {citations.length > 0 && (
            <div className="text-sm text-mutedForeground space-y-1">
              <div className="font-semibold text-foreground">Citations</div>
              {citations.map((c, idx) => (
                <div key={idx}>
                  {c.file_path || "unknown"} {c.similarity ? `(sim: ${c.similarity?.toFixed(2)})` : ""}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

