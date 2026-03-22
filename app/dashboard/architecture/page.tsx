import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import {
  needsOrgIdCanonicalization,
  resolveDashboardOrgId,
  withOrgSearchParams,
} from "@/lib/dashboard-org-server";
import { ArchitectureClient } from "./architecture-client";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default async function ArchitecturePage({ searchParams }: Props) {
  const session = await getServerSession();
  if (!session?.access_token) redirect("/?login=1&error=session_expired");
  const token = session.access_token;

  let orgs: { id: string; name: string }[] = [];
  try {
    const resp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
    orgs = resp.organizations || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) redirect("/?login=1&error=session_expired");
    throw e;
  }

  if (!orgs.length) redirect("/onboarding");

  const orgIdParam = Array.isArray(searchParams["org_id"]) ? searchParams["org_id"][0] : searchParams["org_id"];
  const orgId = resolveDashboardOrgId(orgs, orgIdParam);
  if (needsOrgIdCanonicalization(orgs, orgIdParam)) {
    redirect(withOrgSearchParams("/dashboard/architecture", searchParams, orgId));
  }

  const [capsResp, reposResp] = await Promise.all([
    backendFetch<{ capabilities: any[] }>(`/orgs/${orgId}/capabilities`, token).catch(() => ({ capabilities: [] })),
    backendFetch<{ repositories: any[] }>(`/orgs/${orgId}/repositories`, token).catch(() => ({ repositories: [] })),
  ]);

  return (
    <ArchitectureClient
      orgId={orgId}
      capabilities={capsResp.capabilities || []}
      repositories={reposResp.repositories || []}
      token={token}
    />
  );
}
