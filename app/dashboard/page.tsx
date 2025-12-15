import { Suspense } from "react";
import Link from "next/link";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardSkeleton } from "@/components/ui/loading-skeleton";

async function ensureOrg() {
  "use server";
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Not authenticated");
  }
  await backendFetch("/installations/bootstrap", token, { method: "POST" });
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

      {!hasOrg ? (
        <Card>
          <CardHeader>
            <CardTitle>No organization yet</CardTitle>
            <CardDescription>Bootstrap an org to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={ensureOrg}>
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

