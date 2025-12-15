"use server";

import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "./server";
import { getSupabaseServerClient } from "./server";

export async function deleteAccountAction() {
  const session = await getServerSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    // Call backend to delete all user data and the auth user
    await backendFetch<{ success: boolean; message: string }>(
      "/account/delete",
      token,
      { method: "DELETE" }
    );

    // Sign out locally to clear any remaining session
    const supabase = getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    // Even if there's an error, try to sign out locally
    const supabase = getSupabaseServerClient();
    await supabase.auth.signOut();
    throw error;
  }

  redirect("/login");
}
