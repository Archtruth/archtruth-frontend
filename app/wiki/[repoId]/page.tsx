import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { isUnauthorizedBackendError, listWikiPages, listOrgDocuments } from "@/lib/api/backend";
import { FullScreenWikiClient } from "./client";

type PageProps = {
  params: { repoId: string };
  searchParams?: { org_id?: string };
};

export default async function FullScreenWikiPage({ params, searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const repoId = Number(params.repoId);
  const orgId = searchParams?.org_id;

  let pagesResp: Awaited<ReturnType<typeof listWikiPages>>;
  try {
    pagesResp = await listWikiPages(repoId, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  let orgDocs: Awaited<ReturnType<typeof listOrgDocuments>>["documents"] = [];
  if (orgId) {
    try {
      const orgDocsResp = await listOrgDocuments(orgId, token);
      orgDocs = orgDocsResp.documents || [];
    } catch (e) {
      // Non-fatal: continue without org docs
      console.error("Failed to load org docs", e);
    }
  }

  const backHref = orgId
    ? `/dashboard/repos?org_id=${encodeURIComponent(orgId)}`
    : "/dashboard/repos";

  return (
    <FullScreenWikiClient
      repoId={repoId}
      orgId={orgId}
      token={token}
      backHref={backHref}
      pages={pagesResp.pages || []}
      orgDocs={orgDocs}
    />
  );
}

