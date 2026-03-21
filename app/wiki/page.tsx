import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { listOrgRepositories, listOrgDocuments, listWikiPages, listOrgCapabilities } from "@/lib/api/backend";
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
  let capabilities: any[] = [];

  try {
    const orgDocsResp = await listOrgDocuments(orgId, token);
    orgDocs = orgDocsResp.documents || [];
  } catch (e) {
    console.error("Failed to load org docs for org wiki", e);
  }

  try {
    const reposResp = await listOrgRepositories(orgId, token);
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
    console.error("Failed to load org repositories for org wiki", e);
  }

  try {
    const capsResp = await listOrgCapabilities(orgId, token);
    capabilities = capsResp.capabilities || [];
  } catch (e) {
    console.error("Failed to load capabilities for org wiki", e);
  }

  const backHref = `/dashboard/repos?org_id=${encodeURIComponent(orgId)}`;

  return (
    <OrgWikiClient
      orgId={orgId}
      token={token}
      backHref={backHref}
      orgDocs={orgDocs}
      repos={repos}
      capabilities={capabilities}
    />
  );
}
