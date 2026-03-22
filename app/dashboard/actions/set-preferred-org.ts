"use server";

import { cookies } from "next/headers";
import { PREFERRED_ORG_COOKIE } from "@/lib/org-preference-constants";

export async function setPreferredOrganization(orgId: string) {
  if (!orgId || orgId.length > 64) return;
  cookies().set(PREFERRED_ORG_COOKIE, orgId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
