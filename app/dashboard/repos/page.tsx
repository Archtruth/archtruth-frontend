import { Suspense } from "react";
import { redirect } from "next/navigation";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { ReposList } from "./repos-list";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

async function ReposContent({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session?.access_token) redirect("/?login=1&error=session_expired");
  const token = session.access_token;

  const orgIdParam = Array.isArray(searchParams["org_id"]) ? searchParams["org_id"][0] : searchParams["org_id"];

  let orgs: { id: string; name: string }[] = [];
  try {
    const resp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
    orgs = resp.organizations || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
    throw e;
  }

  const orgId = orgIdParam || orgs[0]?.id;
  if (!orgId) redirect("/onboarding");

  // Parallel fetches
  const [installsResp, reposResp, capsResp] = await Promise.all([
    backendFetch<{ installations: any[] }>(`/orgs/${orgId}/installations`, token).catch(() => ({ installations: [] })),
    backendFetch<{ repositories: any[] }>(`/orgs/${orgId}/repositories`, token).catch(() => ({ repositories: [] })),
    backendFetch<{ capabilities: any[] }>(`/orgs/${orgId}/capabilities`, token).catch(() => ({ capabilities: [] })),
  ]);

  const installations = installsResp.installations || [];
  const connectedRepos = reposResp.repositories || [];
  const capabilities = capsResp.capabilities || [];

  // Fetch available repos per installation in parallel
  const reposByInstall: Record<number, any[]> = {};
  await Promise.all(
    installations.map(async (install: any) => {
      try {
        const list = await backendFetch<{ repositories: any[] }>(
          `/installations/${install.installation_id}/repos`, token
        );
        reposByInstall[install.installation_id] = list.repositories || [];
      } catch {
        reposByInstall[install.installation_id] = [];
      }
    })
  );

  return (
    <ReposList
      initialInstallations={installations}
      initialReposByInstall={reposByInstall}
      initialConnectedRepos={connectedRepos}
      initialCapabilities={capabilities}
      orgId={orgId}
      token={token}
    />
  );
}

export default function ReposPage({ searchParams }: Props) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-muted rounded w-48" />
          <div className="h-4 bg-muted rounded w-64" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-40 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      }
    >
      <ReposContent searchParams={searchParams} />
    </Suspense>
  );
}
