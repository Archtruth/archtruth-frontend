import { cookies } from "next/headers";
import { PREFERRED_ORG_COOKIE } from "@/lib/org-preference-constants";

function orgSet(orgs: { id: string }[]) {
  return new Set(orgs.map((o) => o.id));
}

/** Resolve org id: valid URL param wins, then cookie, then first org. */
export function resolveDashboardOrgId(orgs: { id: string }[], urlOrgId: string | undefined): string {
  if (!orgs.length) throw new Error("resolveDashboardOrgId: no organizations");
  const allowed = orgSet(orgs);
  if (urlOrgId && allowed.has(urlOrgId)) return urlOrgId;
  const cookieVal = cookies().get(PREFERRED_ORG_COOKIE)?.value;
  if (cookieVal && allowed.has(cookieVal)) return cookieVal;
  return orgs[0].id;
}

/** True when URL is missing org_id or it is not in the user's org list. */
export function needsOrgIdCanonicalization(orgs: { id: string }[], urlOrgId: string | undefined): boolean {
  if (!urlOrgId) return true;
  return !orgSet(orgs).has(urlOrgId);
}

/** Build same path with org_id set (preserves other query keys). */
export function withOrgSearchParams(
  pathname: string,
  searchParams: { [key: string]: string | string[] | undefined },
  orgId: string
): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) {
    if (k === "org_id") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") qs.set(k, val);
  }
  qs.set("org_id", orgId);
  return `${pathname}?${qs.toString()}`;
}
