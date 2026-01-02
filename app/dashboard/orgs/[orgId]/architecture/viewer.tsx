"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Loader, Network, ChevronLeft } from "lucide-react";
import { presignOrgDocument } from "@/lib/api/backend-client";
import { MermaidBlock } from "@/components/markdown/MermaidBlock";

type Document = {
  id: number;
  file_path: string;
  updated_at?: string;
};

async function fetchDoc(orgId: string, fileName: string, token: string): Promise<string> {
  const presigned = await presignOrgDocument(orgId, fileName, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch document");
  }
  return resp.text();
}

export default function ArchitectureClient({ orgId, token, docs }: { orgId: string; token: string; docs: Document[] }) {
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const architectureDoc = useMemo(() => docs.find((d) => d.file_path === "org_architecture.md"), [docs]);

  useEffect(() => {
    if (!architectureDoc) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const content = await fetchDoc(orgId, architectureDoc.file_path, token);
        setMarkdown(content);
      } catch (e: any) {
        setError(e?.message || "Failed to load architecture doc");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [architectureDoc, orgId, token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/orgs/${orgId}/docs`}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">Architecture Map</h1>
            <p className="text-mutedForeground">Mermaid diagram and evidence-backed system view.</p>
          </div>
        </div>
        <Link href={`/dashboard/orgs/${orgId}/docs`}>
          <Button variant="outline">Back to Org Docs</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Org Architecture
          </CardTitle>
          <CardDescription>Rendered from org_architecture.md</CardDescription>
        </CardHeader>
        <CardContent>
          {!architectureDoc ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-mutedForeground" />
              </div>
              <h3 className="text-lg font-medium">No architecture doc yet</h3>
              <p className="text-mutedForeground max-w-sm mt-2">Ingest repositories to generate org-level architecture.</p>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-6 w-6 animate-spin mr-2" />
              Loading architecture...
            </div>
          ) : error ? (
            <div className="text-sm text-destructive">{error}</div>
          ) : (
            <article className="prose dark:prose-invert max-w-none">
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
                {markdown}
              </ReactMarkdown>
            </article>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

