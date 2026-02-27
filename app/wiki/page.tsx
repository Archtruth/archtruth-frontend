import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { isUnauthorizedBackendError, listOrgRepositories, listOrgDocuments, listWikiPages } from "@/lib/api/backend";
import { OrgWikiClient } from "./org-client";

type PageProps = {
  searchParams?: { org_id?: string };
};

export default async function OrgWikiPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const orgId = searchParams?.org_id;

  if (!orgId) {
    redirect("/dashboard/repos");
  }

  let orgDocs: Awaited<ReturnType<typeof listOrgDocuments>>["documents"] = [];
  let repos: { id: number; full_name: string; pages: { id: number; slug: string; title: string; category?: string; nav_order?: number; updated_at?: string; last_indexed_commit_sha?: string; indexed_at?: string }[] }[] = [];

  try {
    const [orgDocsResp, reposResp] = await Promise.all([
      listOrgDocuments(orgId, token),
      listOrgRepositories(orgId, token),
    ]);
    orgDocs = orgDocsResp.documents || [];
    const repoList = reposResp.repositories || [];

    const pagesByRepo = await Promise.all(
      repoList.map(async (repo) => {
        try {
          const pagesResp = await listWikiPages(repo.id, token);
          const pages = (pagesResp.pages || []).sort((a, b) => {
            const aOrder = (a as { nav_order?: number }).nav_order ?? 0;
            const bOrder = (b as { nav_order?: number }).nav_order ?? 0;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.title ?? "").localeCompare(b.title ?? "");
          });
          return { ...repo, pages };
        } catch {
          return { ...repo, pages: [] };
        }
      })
    );
    repos = pagesByRepo.filter((r) => r.pages.length > 0);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  const backHref = `/dashboard/repos?org_id=${encodeURIComponent(orgId)}`;

  return (
    <OrgWikiClient
      orgId={orgId}
      token={token}
      backHref={backHref}
      orgDocs={orgDocs}
      repos={repos}
    />
  );
}
