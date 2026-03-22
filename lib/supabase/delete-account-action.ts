"use server";

import { redirect } from "next/navigation";
import { backendFetch } from "@/lib/api/backend";
import { getServerSession } from "./server";

export async function deleteAccountAction() {
  const session = await getServerSession();
  const token = session?.access_token;

  if (!token) {
    throw new Error("Not authenticated");
  }

  try {
    await backendFetch<{ success: boolean; message: string }>(
      "/account/delete",
      token,
      { method: "DELETE" }
    );
  } catch (error) {
    throw error;
  }

  // Cookie clearing must happen in a Route Handler (server action signOut is a no-op for cookies).
  redirect("/auth/sign-out?next=" + encodeURIComponent("/?login=1&notice=account_deleted"));
}
