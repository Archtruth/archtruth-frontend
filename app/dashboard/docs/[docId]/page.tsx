import { notFound } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { presignDocument } from "@/lib/api/backend";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
    return notFound();
  }
  const token = session.access_token;
  const docId = Number(params.docId);
  if (!docId) {
    return notFound();
  }

  const presigned = await presignDocument(docId, token);
  const markdown = await fetchMarkdown(presigned.url);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Document #{docId}</h1>
        <Link href="/dashboard/repos">
          <Button variant="outline">Back to repos</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Markdown</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap text-sm font-mono">{markdown}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

