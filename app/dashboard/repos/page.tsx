import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReposSkeleton } from "@/components/ui/loading-skeleton";
import { ReposList } from "./repos-list";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

async function ReposContent({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;

  const orgIdParam = Array.isArray(searchParams["org_id"]) ? searchParams["org_id"][0] : searchParams["org_id"];
  let orgsResp: { organizations: { id: string; name: string }[] };
  try {
    orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }
  const orgs = orgsResp.organizations || [];
  const selectedOrgId = orgIdParam || orgs[0]?.id;

  if (!selectedOrgId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No organizations</CardTitle>
          <CardDescription>Create one first from the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard">
            <Button variant="outline">Back to dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  let installations: { installation_id: number; account_login: string }[] = [];
  let connectedRepos: any[] = [];
  try {
    const installationsResp = await backendFetch<{ installations: { installation_id: number; account_login: string }[] }>(
      `/orgs/${selectedOrgId}/installations`,
      token
    );
    installations = installationsResp.installations || [];

    const connectedResp = await backendFetch<{ repositories: any[] }>(
      `/orgs/${selectedOrgId}/repositories`,
      token
    );
    connectedRepos = connectedResp.repositories || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  // Fetch repos per installation
  const reposByInstall: Record<number, any[]> = {};
  for (const install of installations) {
    try {
      const list = await backendFetch<{ repositories: any[] }>(
        `/installations/${install.installation_id}/repos`,
        token
      );
      reposByInstall[install.installation_id] = list.repositories || [];
    } catch (e) {
      if (isUnauthorizedBackendError(e)) {
        redirect("/?login=1&error=session_expired");
      }
      throw e;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Repositories</h1>
          <p className="text-mutedForeground">
            Select a repository under an installation for org <span className="font-semibold">{selectedOrgId}</span>.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Switch between your organizations.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {orgs.map((org) => {
            const isActive = org.id === selectedOrgId;
            return (
              <Link key={org.id} href={`/dashboard/repos?org_id=${org.id}`}>
                <Button variant={isActive ? "default" : "outline"} size="sm">
                  {org.name}
                </Button>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <ReposList
        initialInstallations={installations}
        initialReposByInstall={reposByInstall}
        initialConnectedRepos={connectedRepos}
        orgId={selectedOrgId}
        token={token}
      />
    </div>
  );
}

export default function ReposPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<ReposSkeleton />}>
      <ReposContent searchParams={searchParams} />
    </Suspense>
  );
}
