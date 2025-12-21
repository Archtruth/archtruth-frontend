import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "@/lib/supabase/server";
import { isUnauthorizedBackendError, listWikiPages } from "@/lib/api/backend";
import { RepoWikiPageClient } from "./client";

type PageProps = {
  params: { repoId: string };
  searchParams?: { org_id?: string };
};

export default async function RepoWikiPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const repoId = Number(params.repoId);

  let pagesResp: Awaited<ReturnType<typeof listWikiPages>>;
  try {
    pagesResp = await listWikiPages(repoId, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  const backHref = searchParams?.org_id
    ? `/dashboard/repos?org_id=${encodeURIComponent(searchParams.org_id)}`
    : "/dashboard/repos";

  return <RepoWikiPageClient repoId={repoId} token={token} backHref={backHref} pages={pagesResp.pages || []} />;
}


