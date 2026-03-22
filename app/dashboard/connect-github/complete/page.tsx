import { redirect } from "next/navigation";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check, AlertTriangle } from "lucide-react";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ConnectGithubComplete({ searchParams }: Props) {
  const installationIdRaw = searchParams["installation_id"];
  const installationId = Array.isArray(installationIdRaw) ? installationIdRaw[0] : installationIdRaw;
  const stateOrgRaw = searchParams["state"];
  const stateOrg = Array.isArray(stateOrgRaw) ? stateOrgRaw[0] : stateOrgRaw;
  const connectGithubHref = stateOrg
    ? `/dashboard/connect-github?org_id=${encodeURIComponent(stateOrg)}`
    : "/dashboard/connect-github";

  if (!installationId) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Missing installation</h2>
          <p className="text-sm text-muted-foreground">GitHub did not return an installation ID. Please retry the install flow.</p>
          <Link href="/dashboard/connect-github">
            <Button variant="outline">Go back</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }

  if (!stateOrg) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-semibold">Missing workspace context</h2>
          <p className="text-sm text-muted-foreground">
            Please restart the GitHub App installation from the Connect GitHub page.
          </p>
          <Link href={connectGithubHref}>
            <Button variant="outline">Go back</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  try {
    const token = session.access_token;
    await backendFetch("/installations/link", token, {
      method: "POST",
      body: JSON.stringify({
        installation_id: Number(installationId),
        organization_id: stateOrg,
      }),
    });

    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-6 text-center space-y-4">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <h2 className="text-xl font-semibold">GitHub App Connected!</h2>
          <p className="text-sm text-muted-foreground">
            Your GitHub App has been successfully installed and linked to your workspace.
          </p>
          <Link href={`/dashboard/repos?org_id=${stateOrg}`}>
            <Button className="gap-1.5 w-full">
              Continue to Repositories
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  } catch (err: any) {
    if (isUnauthorizedBackendError(err)) {
      redirect("/?login=1&error=session_expired");
    }
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardContent className="p-6 text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
          <h2 className="text-lg font-semibold">Connection failed</h2>
          <p className="text-sm text-muted-foreground">{String(err?.message || err)}</p>
          <Link href={connectGithubHref}>
            <Button variant="outline">Try again</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }
}
