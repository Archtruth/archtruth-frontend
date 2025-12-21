import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { listOrgDocuments, isUnauthorizedBackendError } from "@/lib/api/backend";
import ArchitectureClient from "./viewer";

type PageProps = {
  params: { orgId: string };
};

export default async function OrgArchitecturePage({ params }: PageProps) {
  const session = await getServerSession();
  if (!session?.access_token) {
    redirect("/?login=1&error=session_expired");
  }
  const token = session.access_token;
  const orgId = params.orgId;

  let docsResp: Awaited<ReturnType<typeof listOrgDocuments>>;
  try {
    docsResp = await listOrgDocuments(orgId, token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }
  const docs = docsResp.documents || [];

  return <ArchitectureClient orgId={orgId} token={token} docs={docs} />;
}

