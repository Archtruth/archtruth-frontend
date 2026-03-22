import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { SettingsClient } from "./settings-client";
import { deleteAccountAction } from "@/lib/supabase/delete-account-action";

export default async function SettingsPage() {
  const session = await getServerSession();
  if (!session?.access_token) redirect("/?login=1&error=session_expired");
  const token = session.access_token;

  let orgs: { id: string; name: string }[] = [];
  try {
    const resp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
    orgs = resp.organizations || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
  }

  const orgId = orgs[0]?.id;
  const orgName = orgs[0]?.name || "Workspace";
  if (!orgId) redirect("/onboarding");

  let installationInfo: any = null;
  try {
    const resp = await backendFetch<{ installations: any[] }>(`/orgs/${orgId}/installations`, token);
    installationInfo = resp.installations?.[0] || null;
  } catch {}

  let repoCount = 0;
  try {
    const resp = await backendFetch<{ repositories: any[] }>(`/orgs/${orgId}/repositories`, token);
    repoCount = resp.repositories?.length || 0;
  } catch {}

  return (
    <SettingsClient
      orgId={orgId}
      orgName={orgName}
      installation={installationInfo}
      repoCount={repoCount}
      token={token}
      onDeleteAccount={deleteAccountAction}
    />
  );
}
