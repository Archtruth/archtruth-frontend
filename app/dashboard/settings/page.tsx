import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import {
  needsOrgIdCanonicalization,
  resolveDashboardOrgId,
  withOrgSearchParams,
} from "@/lib/dashboard-org-server";
import { SettingsClient } from "./settings-client";
import { deleteAccountAction } from "@/lib/supabase/delete-account-action";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
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

  if (!orgs.length) redirect("/onboarding");

  const urlOrg = Array.isArray(searchParams.org_id) ? searchParams.org_id[0] : searchParams.org_id;
  const orgId = resolveDashboardOrgId(orgs, urlOrg);
  if (needsOrgIdCanonicalization(orgs, urlOrg)) {
    redirect(withOrgSearchParams("/dashboard/settings", searchParams, orgId));
  }
  const orgName = orgs.find((o) => o.id === orgId)?.name || "Workspace";

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
