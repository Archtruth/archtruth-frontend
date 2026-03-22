import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import {
  needsOrgIdCanonicalization,
  resolveDashboardOrgId,
  withOrgSearchParams,
} from "@/lib/dashboard-org-server";
import { DashboardOverview } from "./dashboard-overview";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;

  let orgs: { id: string; name: string }[] = [];
  try {
    const resp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
    orgs = resp.organizations || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
    throw e;
  }

  if (orgs.length === 0) {
    redirect("/onboarding");
  }

  const urlOrg = Array.isArray(searchParams.org_id) ? searchParams.org_id[0] : searchParams.org_id;
  const orgId = resolveDashboardOrgId(orgs, urlOrg);
  if (needsOrgIdCanonicalization(orgs, urlOrg)) {
    redirect(withOrgSearchParams("/dashboard", searchParams, orgId));
  }

  const orgName = orgs.find((o) => o.id === orgId)?.name || orgs[0].name;
  const userName = session.user?.user_metadata?.full_name || session.user?.user_metadata?.name || "there";

  let dashboardData: any = null;
  try {
    dashboardData = await backendFetch(`/orgs/${orgId}/dashboard-data`, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
  }

  return (
    <DashboardOverview
      orgId={orgId}
      orgName={orgName}
      userName={userName}
      dashboardData={dashboardData}
      token={token}
    />
  );
}
