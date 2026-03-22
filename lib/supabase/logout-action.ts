import { redirect } from "next/navigation";

export function createLogoutAction() {
  return async function logout() {
    "use server";
    // Cookie clearing is done in /auth/sign-out (server action cannot clear Supabase cookies here).
    redirect("/auth/sign-out?next=" + encodeURIComponent("/?login=1"));
  };
}
