import type { ReactNode } from "react";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createLogoutAction } from "@/lib/supabase/logout-action";
import { deleteAccountAction } from "@/lib/supabase/delete-account-action";
import { PREFERRED_ORG_COOKIE } from "@/lib/org-preference-constants";

export const metadata = {
  title: "ArchTruth Dashboard",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/?login=1&next=%2Fdashboard");
  }

  const profile = session.user.user_metadata || {};
  const token = session.access_token;

  let orgOptions: { id: string; name: string }[] = [];
  if (token) {
    try {
      const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
      orgOptions = orgsResp.organizations || [];
    } catch (e) {
      if (isUnauthorizedBackendError(e)) {
        redirect("/?login=1&error=session_expired");
      }
    }
  }

  if (orgOptions.length === 0) {
    redirect("/onboarding");
  }

  const cookieOrg = cookies().get(PREFERRED_ORG_COOKIE)?.value;
  const allowed = new Set(orgOptions.map((o) => o.id));
  const preferredOrgId =
    cookieOrg && allowed.has(cookieOrg) ? cookieOrg : orgOptions[0]?.id ?? null;
  const logoutAction = createLogoutAction();

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <DashboardShell
        userName={profile.full_name || profile.name}
        userAvatar={profile.avatar_url}
        onLogout={logoutAction}
        onDeleteAccount={deleteAccountAction}
        orgOptions={orgOptions}
        preferredOrgId={preferredOrgId}
      >
        {children}
      </DashboardShell>
    </Suspense>
  );
}
