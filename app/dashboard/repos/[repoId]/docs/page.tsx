import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { isUnauthorizedBackendError, listDocuments } from "@/lib/api/backend";
import { RepoDocsPageClient } from "./client";

type PageProps = {
  params: { repoId: string };
  searchParams?: { org_id?: string };
};

export default async function RepoDocsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const repoId = Number(params.repoId);

  let docsResp: Awaited<ReturnType<typeof listDocuments>>;
  try {
    docsResp = await listDocuments(repoId, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }
  const docs = docsResp.documents || [];

  const backHref = searchParams?.org_id ? `/dashboard/repos?org_id=${encodeURIComponent(searchParams.org_id)}` : "/dashboard/repos";

  return <RepoDocsPageClient repoId={repoId} token={token} backHref={backHref} docs={docs} />;
}
