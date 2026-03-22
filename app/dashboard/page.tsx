import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { DashboardOverview } from "./dashboard-overview";

export default async function DashboardPage() {
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

  const orgId = orgs[0].id;
  const orgName = orgs[0].name;
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
