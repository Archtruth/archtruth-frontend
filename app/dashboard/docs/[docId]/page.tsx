import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { isUnauthorizedBackendError, presignDocument } from "@/lib/api/backend";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";
import { ChevronLeft } from "lucide-react";

type PageProps = {
  params: { docId: string };
};

async function fetchMarkdown(url: string): Promise<string> {
  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) {
    throw new Error("Failed to fetch document");
  }
  return resp.text();
}

export default async function DocPage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const docId = Number(params.docId);
  if (!docId) {
    return notFound();
  }

  let presigned: Awaited<ReturnType<typeof presignDocument>>;
  try {
    presigned = await presignDocument(docId, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }
  const markdown = await fetchMarkdown(presigned.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <Link href="/dashboard/repos">
              <Button variant="ghost" size="icon">
                  <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-2xl font-semibold">Document Viewer</h1>
        </div>
        <Link href="/dashboard/repos">
          <Button variant="outline">Back to repos</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 border-b">
          <CardTitle className="font-mono text-sm">Doc ID: {docId}</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <article className="prose dark:prose-invert max-w-none">
            <ReactMarkdown>{markdown}</ReactMarkdown>
          </article>
        </CardContent>
      </Card>
    </div>
  );
}
