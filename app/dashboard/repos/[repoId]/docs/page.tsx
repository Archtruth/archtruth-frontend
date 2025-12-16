import Link from "next/link";
import { getServerSession } from "@/lib/supabase/server";
import { listDocuments } from "@/lib/api/backend";
import { RepoDocsPageClient } from "./client";

type PageProps = {
  params: { repoId: string };
  searchParams?: { org_id?: string };
};

export default async function RepoDocsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    return null;
  }
  const token = session.access_token;
  const repoId = Number(params.repoId);

  const docsResp = await listDocuments(repoId, token);
  const docs = docsResp.documents || [];

  const backHref = searchParams?.org_id ? `/dashboard/repos?org_id=${encodeURIComponent(searchParams.org_id)}` : "/dashboard/repos";

  return <RepoDocsPageClient repoId={repoId} token={token} backHref={backHref} docs={docs} />;
}
