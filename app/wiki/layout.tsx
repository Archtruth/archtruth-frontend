import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";

export default async function WikiLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect("/?login=1&next=%2Fwiki");
  }

  // Return children without dashboard shell wrapper
  return <>{children}</>;
}

