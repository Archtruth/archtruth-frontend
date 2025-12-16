import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
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
  const logoutAction = createLogoutAction();

  return (
    <DashboardShell
      userName={profile.full_name || profile.name}
      userAvatar={profile.avatar_url}
      onLogout={logoutAction}
      onDeleteAccount={deleteAccountAction}
    >
      {children}
    </DashboardShell>
  );
}

