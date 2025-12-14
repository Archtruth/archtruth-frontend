import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "@/lib/supabase/server";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ReposPage({ searchParams }: Props) {
  const installationIdRaw = searchParams["installation_id"];
  const installationId = Array.isArray(installationIdRaw) ? installationIdRaw[0] : installationIdRaw;

  const session = await getServerSession();
  if (!session?.access_token) {
    return (
      <>
        <h1>Sign in required</h1>
        <p>Please sign in to Supabase Auth.</p>
      </>
    );
  }

  if (!installationId) {
    return (
      <>
        <h1>Provide installation_id</h1>
        <p>Add ?installation_id=12345 to the URL after completing the install flow.</p>
      </>
    );
  }

  const token = session.access_token;
  const reposResp = await backendFetch<{ repositories: any[] }>(
    `/installations/${installationId}/repos`,
    token
  );
  const repos = reposResp.repositories || [];

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
    <>
      <h1>Repositories</h1>
      <p>Select a repository to connect and trigger a full scan.</p>
      <ul>
        {repos.map((repo) => (
          <li key={repo.id} style={{ marginBottom: "12px" }}>
            <div>{repo.full_name}</div>
            <form action={connectRepo}>
              <input type="hidden" name="repo_id" value={repo.id} />
              <input type="hidden" name="full_name" value={repo.full_name} />
              <input type="hidden" name="installation_id" value={installationId} />
              <button type="submit">Connect & Enqueue full_scan</button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}

