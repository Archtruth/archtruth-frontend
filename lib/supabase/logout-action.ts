import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "./server";

export function createLogoutAction() {
  return async function logout() {
    "use server";
    const supabase = getSupabaseServerClient();
    await supabase.auth.signOut();
    redirect("/login");
  };
}
