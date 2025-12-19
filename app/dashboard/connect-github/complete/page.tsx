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

  if (!stateOrg) {
    return (
      <>
        <h1>Missing organization context</h1>
        <p>
          We did not receive an <code>org_id</code> in the callback state. Please restart the GitHub App installation
          from the Connect GitHub page and select an organization before installing.
        </p>
        <p className="mt-3">
          <a href="/dashboard/connect-github" className="underline">
            Go back to Connect GitHub
          </a>
        </p>
      </>
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
      <>
        <h1>Installation linked</h1>
        <p>Installation {installationId} has been linked to org {stateOrg}.</p>
        <p>
          Continue to{" "}
          <a href={`/dashboard/repos?org_id=${stateOrg}`} className="underline">
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

