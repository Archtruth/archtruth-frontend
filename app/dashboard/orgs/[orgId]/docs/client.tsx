"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { presignOrgDocument } from "@/lib/api/backend-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ChevronLeft, Calendar, Loader } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Document = {
  id: number;
  file_path: string;
  updated_at?: string;
};

async function fetchDocumentContent(orgId: string, fileName: string, token: string): Promise<string> {
  const presigned = await presignOrgDocument(orgId, fileName, token);
  const resp = await fetch(presigned.url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch document");
  }
  return resp.text();
}

export function OrgDocsPageClient({
  orgId,
  token,
  backHref,
  docs,
}: {
  orgId: string;
  token: string;
  backHref: string;
  docs: Document[];
}) {
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedFile && docs.length > 0) {
      const loadDoc = async () => {
        setLoading(true);
        try {
          const content = await fetchDocumentContent(orgId, selectedFile, token);
          setMarkdown(content);
        } catch (error) {
          console.error("Failed to load document:", error);
          setMarkdown("Failed to load document content.");
        } finally {
          setLoading(false);
        }
      };
      loadDoc();
    }
  }, [selectedFile, token, docs, orgId]);

  const selectedDoc = docs.find((d) => d.file_path === selectedFile);

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
            <h1 className="text-2xl font-semibold">Org Docs</h1>
            <p className="text-mutedForeground">System-level docs aggregated across repositories.</p>
          </div>
        </div>
        <Link href={backHref}>
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Org Documentation
          </CardTitle>
          <CardDescription>Architecture, overview, and interfaces for this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-8 w-8 text-mutedForeground" />
              </div>
              <h3 className="text-lg font-medium">No documents found</h3>
              <p className="text-mutedForeground max-w-sm mt-2">
                Trigger a sync from the repositories page to generate organization docs.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Document</label>
                <Select value={selectedFile} onValueChange={setSelectedFile}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a document to view..." />
                  </SelectTrigger>
                  <SelectContent>
                    {docs.map((doc) => (
                      <SelectItem key={doc.file_path} value={doc.file_path}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-mono text-sm">{doc.file_path}</span>
                          {doc.updated_at && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(doc.updated_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedFile && (
                <Card>
                  <CardHeader className="bg-muted/30 border-b">
                    <CardTitle className="font-mono text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {selectedDoc?.file_path}
                      {selectedDoc?.updated_at && (
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(selectedDoc.updated_at).toLocaleDateString()}
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    {loading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader className="h-6 w-6 animate-spin mr-2" />
                        Loading document...
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

