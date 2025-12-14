import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ConnectGithubComplete({ searchParams }: Props) {
  const installationIdRaw = searchParams["installation_id"];
  const installationId = Array.isArray(installationIdRaw) ? installationIdRaw[0] : installationIdRaw;
  const stateOrgRaw = searchParams["state"];
  const stateOrg = Array.isArray(stateOrgRaw) ? stateOrgRaw[0] : stateOrgRaw;

  if (!installationId) {
    return (
      <>
        <h1>Missing installation_id</h1>
        <p>GitHub did not return an installation_id. Re-run the install flow.</p>
      </>
    );
  }

  const session = await getServerSession();
  if (!session?.access_token) {
    return (
      <>
        <h1>Sign in required</h1>
        <p>Please sign in to Supabase Auth and retry the GitHub App install redirect.</p>
      </>
    );
  }

  try {
    const token = session.access_token;
    // If state (org_id) provided, skip bootstrap; otherwise ensure org.
    if (!stateOrg) {
      await backendFetch("/installations/bootstrap", token, { method: "POST" });
    }
    await backendFetch("/installations/link", token, {
      method: "POST",
      body: JSON.stringify({
        installation_id: Number(installationId),
        organization_id: stateOrg || undefined,
      }),
    });

    return (
      <>
        <h1>Installation linked</h1>
        <p>
          Installation {installationId} has been linked to {stateOrg ? `org ${stateOrg}` : "your organization"}.
        </p>
        <p>
          Continue to{" "}
          <a href={`/dashboard/repos?org_id=${stateOrg || ""}`} className="underline">
            repositories
          </a>{" "}
          to connect a repo.
        </p>
      </>
    );
  } catch (err: any) {
    return (
      <>
        <h1>Linking failed</h1>
        <p>{String(err?.message || err)}</p>
      </>
    );
  }
}

