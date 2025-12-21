import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { createLogoutAction } from "@/lib/supabase/logout-action";
import { deleteAccountAction } from "@/lib/supabase/delete-account-action";

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
      // Non-fatal: keep UI functional without org list.
    }
  }

  const currentOrgId = orgOptions[0]?.id;
  const logoutAction = createLogoutAction();

  return (
    <DashboardShell
      userName={profile.full_name || profile.name}
      userAvatar={profile.avatar_url}
      onLogout={logoutAction}
      onDeleteAccount={deleteAccountAction}
      orgOptions={orgOptions}
      currentOrgId={currentOrgId}
    >
      {children}
    </DashboardShell>
  );
}

