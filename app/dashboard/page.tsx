import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";
import { Input } from "@/components/ui/input";
import { revalidatePath } from "next/cache";

type GithubOrgRow = {
  github_login: string;
  avatar_url?: string | null;
  status: "connected" | "onboarded" | "not_connected";
  archtruth_org_id?: string | null;
  archtruth_org_name?: string | null;
};

async function createOrg(formData: FormData) {
  "use server";
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }
  const name = (formData.get("name") as string | null)?.trim() || "My Org";
  await backendFetch("/orgs", token, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  revalidatePath("/dashboard");
}

async function joinGithubOrg(formData: FormData): Promise<void> {
  "use server";
  const orgLogin = String(formData.get("org_login") || "").trim();
  if (!orgLogin) {
    throw new Error("org_login is required");
  }

  const session = await getServerSession();
  const token = session?.access_token;
  const providerToken = (session as any)?.provider_token as string | undefined;
  if (!token || !providerToken) {
    throw new Error("Not authenticated with GitHub. Please sign out and sign in again.");
  }

  const resp = await backendFetch<{ organization_id: string }>(
    `/github/orgs/${encodeURIComponent(orgLogin)}/join`,
    token,
    {
      method: "POST",
      headers: { "X-GitHub-Token": providerToken },
    }
  );

  // After joining, take the user straight to repos for that workspace.
  // This also avoids needing client-side state refresh logic.
  redirect(`/dashboard/repos?org_id=${encodeURIComponent(resp.organization_id)}`);
}

async function DashboardContent() {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    return null;
  }

  const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
  const orgs = orgsResp.organizations || [];
  const hasOrg = orgs.length > 0;

  const providerToken = (session as any)?.provider_token as string | undefined;
  let githubOrgs: GithubOrgRow[] = [];
  let githubError: string | null = null;
  if (providerToken) {
    try {
      const ghResp = await backendFetch<{ github_orgs: GithubOrgRow[] }>("/github/orgs", token, {
        headers: { "X-GitHub-Token": providerToken },
      });
      githubOrgs = ghResp.github_orgs || [];
    } catch (e: any) {
      githubError = e?.message || "Failed to fetch GitHub organizations.";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-mutedForeground">Manage organizations and GitHub installations.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/connect-github">
            <Button>Connect GitHub</Button>
          </Link>
          <Link href="/dashboard/repos">
            <Button variant="outline">View repos</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>GitHub organizations</CardTitle>
          <CardDescription>
            We show all GitHub orgs you belong to, including those already onboarded by someone else.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!providerToken ? (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-mutedForeground">
              Missing GitHub org access. Please sign out and sign in again (needs <code>read:org</code>).
            </div>
          ) : null}

          {githubError ? (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-mutedForeground">{githubError}</div>
          ) : null}

          {githubOrgs.length === 0 && providerToken && !githubError ? (
            <p className="text-sm text-mutedForeground">No GitHub organizations found for this account.</p>
          ) : null}

          {githubOrgs.length > 0 ? (
            <div className="space-y-2">
              {githubOrgs.map((org) => {
                const status = org.status;
                const badgeVariant =
                  status === "connected" ? "success" : status === "onboarded" ? "secondary" : "outline";
                const badgeText = status === "connected" ? "Connected" : status === "onboarded" ? "Onboarded" : "Not connected";
                return (
                  <div
                    key={org.github_login}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-medium">{org.github_login}</div>
                        <Badge variant={badgeVariant as any}>{badgeText}</Badge>
                      </div>
                      {org.archtruth_org_name ? (
                        <div className="text-xs text-mutedForeground">
                          ArchTruth workspace: <span className="font-medium">{org.archtruth_org_name}</span>
                        </div>
                      ) : (
                        <div className="text-xs text-mutedForeground">Not connected yet.</div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {status === "connected" && org.archtruth_org_id ? (
                        <Link href={`/dashboard/repos?org_id=${encodeURIComponent(org.archtruth_org_id)}`}>
                          <Button size="sm">Open</Button>
                        </Link>
                      ) : null}

                      {status === "onboarded" ? (
                        <form action={joinGithubOrg}>
                          <input type="hidden" name="org_login" value={org.github_login} />
                          <Button size="sm">Join</Button>
                        </form>
                      ) : null}

                      {status === "not_connected" ? (
                        <Link href="/dashboard/connect-github">
                          <Button size="sm" variant="outline">
                            Connect
                          </Button>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {!hasOrg ? (
        <Card>
          <CardHeader>
            <CardTitle>No organization yet</CardTitle>
            <CardDescription>Create an organization to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createOrg} className="flex flex-col gap-3 max-w-md">
              <Input name="name" placeholder="Organization name" required />
              <Button type="submit">Create organization</Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Organizations</CardTitle>
            <CardDescription>Select an organization to manage installations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {orgs.map((org) => (
              <div key={org.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div>
                  <div className="font-medium">{org.name}</div>
                  <div className="text-xs text-mutedForeground">{org.id}</div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/dashboard/connect-github?org_id=${org.id}`}>
                    <Button size="sm" variant="outline">
                      Connect GitHub
                    </Button>
                  </Link>
                  <Link href={`/dashboard/repos?org_id=${org.id}`}>
                    <Button size="sm">View repos</Button>
                  </Link>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

