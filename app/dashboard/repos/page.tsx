import Link from "next/link";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ReposPage({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session?.access_token) {
    return null;
  }
  const token = session.access_token;

  const orgIdParam = Array.isArray(searchParams["org_id"]) ? searchParams["org_id"][0] : searchParams["org_id"];
  const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
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

  const installationsResp = await backendFetch<{ installations: { installation_id: number; account_login: string }[] }>(
    `/orgs/${selectedOrgId}/installations`,
    token
  );
  const installations = installationsResp.installations || [];

  const connectedResp = await backendFetch<{ repositories: { github_repo_id: number; full_name: string }[] }>(
    `/orgs/${selectedOrgId}/repositories`,
    token
  );
  const connectedIds = new Set((connectedResp.repositories || []).map((r) => r.github_repo_id));

  // Fetch repos per installation
  const reposByInstall: Record<number, any[]> = {};
  for (const install of installations) {
    const list = await backendFetch<{ repositories: any[] }>(
      `/installations/${install.installation_id}/repos`,
      token
    );
    reposByInstall[install.installation_id] = list.repositories || [];
  }

  async function connectRepo(formData: FormData) {
    "use server";
    const repoId = Number(formData.get("repo_id"));
    const fullName = String(formData.get("full_name"));
    const installId = Number(formData.get("installation_id"));
    const currentSession = await getServerSession();
    const currentToken = currentSession?.access_token;
    if (!currentToken) {
      throw new Error("Not authenticated");
    }
    await backendFetch("/installations/connect-repo", currentToken, {
      method: "POST",
      body: JSON.stringify({
        installation_id: installId,
        github_repo_id: repoId,
        full_name: fullName,
      }),
    });
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

      {installations.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No installations yet</CardTitle>
            <CardDescription>Install the GitHub App for this organization first.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/dashboard/connect-github?org_id=${selectedOrgId}`}>
              <Button>Install GitHub App</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        installations.map((install) => {
          const repos = reposByInstall[install.installation_id] || [];
          return (
            <Card key={install.installation_id}>
              <CardHeader>
                <CardTitle>Installation #{install.installation_id}</CardTitle>
                <CardDescription>{install.account_login}</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR>
                      <TH>Repository</TH>
                      <TH>Default branch</TH>
                      <TH className="text-right">Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {repos.map((repo) => {
                      const already = connectedIds.has(repo.id);
                      return (
                        <TR key={repo.id}>
                          <TD className="font-medium">{repo.full_name}</TD>
                          <TD>{repo.default_branch || "main"}</TD>
                          <TD className="text-right">
                            {already ? (
                              <Badge variant="success">Connected</Badge>
                            ) : (
                              <form action={connectRepo} className="inline-flex">
                                <input type="hidden" name="repo_id" value={repo.id} />
                                <input type="hidden" name="full_name" value={repo.full_name} />
                                <input type="hidden" name="installation_id" value={install.installation_id} />
                                <Button size="sm" type="submit">
                                  Connect & queue
                                </Button>
                              </form>
                            )}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

