import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectGithubSkeleton } from "@/components/ui/loading-skeleton";

const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || "#";

type GithubOrgRow = {
  github_login: string;
  github_id?: number | string | null;
  avatar_url?: string | null;
  status: "connected" | "onboarded" | "not_connected";
  installation_id?: number | null;
  archtruth_org_id?: string | null;
  archtruth_org_name?: string | null;
  user_is_member?: boolean | null;
};

async function joinGithubOrg(formData: FormData) {
  "use server";
  const orgLogin = String(formData.get("org_login") || "").trim();
  if (!orgLogin) {
    throw new Error("org_login is required");
  }

  const session = await getServerSession();
  const token = session?.access_token;
  const providerToken = (session as any)?.provider_token as string | undefined;
  if (!token || !providerToken) {
    redirect("/?login=1&error=session_expired");
  }

  let resp: { organization_id: string };
  try {
    resp = await backendFetch<{ organization_id: string }>(
      `/github/orgs/${encodeURIComponent(orgLogin)}/join`,
      token,
      {
        method: "POST",
        headers: {
          "X-GitHub-Token": providerToken,
        },
      }
    );
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  redirect(`/dashboard/repos?org_id=${encodeURIComponent(resp.organization_id)}`);
}

async function createWorkspaceAndInstall(formData: FormData) {
  "use server";
  const orgLogin = String(formData.get("org_login") || "").trim();
  if (!orgLogin) {
    throw new Error("org_login is required");
  }

  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    redirect("/?login=1&error=session_expired");
  }

  let created: { organization_id: string; name?: string };
  try {
    created = await backendFetch<{ organization_id: string; name?: string }>(
      "/orgs",
      token,
      {
        method: "POST",
        body: JSON.stringify({ name: orgLogin }),
      }
    );
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  if (!installUrl || installUrl === "#") {
    // Fall back to the standard page if install URL isn't configured.
    redirect(`/dashboard/connect-github?org_id=${encodeURIComponent(created.organization_id)}`);
  }

  redirect(`${installUrl}?state=${encodeURIComponent(created.organization_id)}`);
}

async function ConnectGithubContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    redirect("/?login=1&error=session_expired");
  }

  const providerToken = (session as any)?.provider_token as string | undefined;

  let githubOrgs: GithubOrgRow[] = [];
  let githubError: string | null = null;

  if (!providerToken) {
    githubError = "We couldn't read your GitHub access token. Please sign out and sign in again to grant org access.";
  } else {
    try {
      const ghResp = await backendFetch<{ github_orgs: GithubOrgRow[] }>("/github/orgs", token, {
        headers: { "X-GitHub-Token": providerToken },
      });
      githubOrgs = ghResp.github_orgs || [];
    } catch (e: any) {
      if (isUnauthorizedBackendError(e)) {
        redirect("/?login=1&error=session_expired");
      }
      githubError = e?.message || "Failed to fetch GitHub organizations.";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connect GitHub App</h1>
          <p className="text-mutedForeground">
            We’ll fetch your GitHub organizations, show what’s already connected, and let you join or install the app.
          </p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your GitHub organizations</CardTitle>
          <CardDescription>
            If an org is already onboarded by someone else, you can join it here. Otherwise, create a workspace and install
            the GitHub App.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {githubError ? (
            <div className="rounded-md border border-border bg-muted p-3 text-sm text-mutedForeground">
              {githubError} (Tip: make sure GitHub OAuth scope includes <code>read:org</code>.)
            </div>
          ) : null}

          {githubOrgs.length === 0 && !githubError ? (
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
                    <div className="flex min-w-0 items-center gap-3">
                      {org.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={`${org.github_login} avatar`}
                          src={org.avatar_url}
                          className="h-8 w-8 rounded-full border border-border"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted" />
                      )}

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
                          <div className="text-xs text-mutedForeground">No ArchTruth workspace yet.</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {status === "connected" && org.archtruth_org_id ? (
                        <Link href={`/dashboard/repos?org_id=${encodeURIComponent(org.archtruth_org_id)}`}>
                          <Button size="sm">View repos</Button>
                        </Link>
                      ) : null}

                      {status === "onboarded" ? (
                        <form action={joinGithubOrg}>
                          <input type="hidden" name="org_login" value={org.github_login} />
                          <Button size="sm">Join</Button>
                        </form>
                      ) : null}

                      {status === "not_connected" ? (
                        <form action={createWorkspaceAndInstall}>
                          <input type="hidden" name="org_login" value={org.github_login} />
                          <Button size="sm">Create workspace &amp; install</Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ConnectGithub({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return (
    <Suspense fallback={<ConnectGithubSkeleton />}>
      <ConnectGithubContent searchParams={searchParams} />
    </Suspense>
  );
}

