import { Suspense } from "react";
import Link from "next/link";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConnectGithubSkeleton } from "@/components/ui/loading-skeleton";

const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || "#";

async function ConnectGithubContent({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    return null;
  }

  const orgIdParam = Array.isArray(searchParams.org_id) ? searchParams.org_id[0] : searchParams.org_id;
  const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
  const orgs = orgsResp.organizations || [];
  const selectedOrgId = orgIdParam || orgs[0]?.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Connect GitHub App</h1>
          <p className="text-mutedForeground">Choose an organization, then install the GitHub App with state for linking.</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select organization</CardTitle>
          <CardDescription>We will link the installation to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {orgs.length === 0 ? (
            <p className="text-sm text-mutedForeground">No organizations yet. Go back and create one.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {orgs.map((org) => {
                const isActive = org.id === selectedOrgId;
                return (
                  <Link key={org.id} href={`/dashboard/connect-github?org_id=${org.id}`}>
                    <Button variant={isActive ? "default" : "outline"} size="sm">
                      {org.name}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOrgId ? (
        <Card>
          <CardHeader>
            <CardTitle>Install GitHub App</CardTitle>
            <CardDescription>
              We append <code>state={selectedOrgId}</code> so the callback knows which organization to link.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-mutedForeground">
              After installing, GitHub will redirect you back with <code>installation_id</code> and <code>state</code>.
              We’ll then call the backend to link the installation.
            </div>
            <a href={`${installUrl}?state=${selectedOrgId}`}>
              <Button>Install GitHub App</Button>
            </a>
            <div className="text-xs text-mutedForeground">
              If you already installed, proceed to the completion step with the returned <code>installation_id</code>.
            </div>
          </CardContent>
        </Card>
      ) : null}
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

