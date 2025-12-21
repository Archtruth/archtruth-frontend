"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { presignWikiPage } from "@/lib/api/backend-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ChevronLeft, Calendar, Loader, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";

type WikiPage = {
  id: number;
  slug: string;
  title: string;
  category?: string;
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
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Repository Wiki
            </h1>
            <p className="text-mutedForeground">Browse wiki-style artifacts generated from the repo.</p>
          </div>
        </div>
        <Link href={backHref}>
          <Button variant="outline">Back to repos</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Wiki Pages
          </CardTitle>
          <CardDescription>Structured docs that update when code changes are ingested.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <BookOpen className="h-8 w-8 text-mutedForeground" />
              </div>
              <h3 className="text-lg font-medium">No wiki pages found</h3>
              <p className="text-mutedForeground max-w-sm mt-2">
                Run a repository sync to generate wiki artifacts.
              </p>
              <Link href={backHref} className="mt-4">
                <Button>Go to Repositories</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Page</label>
                <Select value={selectedSlug} onValueChange={setSelectedSlug}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a wiki page to view..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((p) => (
                      <SelectItem key={p.slug} value={p.slug}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-mono text-sm">{p.slug}</span>
                          <span className="text-sm text-muted-foreground">{p.title}</span>
                          {p.updated_at && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(p.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSlug && (
                <Card>
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="font-mono text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {selected?.title || selectedSlug}
                      {selected?.updated_at && (
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(selected.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader className="h-6 w-6 animate-spin mr-2" />
                        Loading wiki page...
                      </div>
                    ) : (
                      <article className="prose dark:prose-invert max-w-none">
                        <ReactMarkdown>{markdown}</ReactMarkdown>
                      </article>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


