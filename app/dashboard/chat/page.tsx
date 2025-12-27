import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { ChatClient } from "./chat-client";

type Props = {
  searchParams: { [key: string]: string | string[] | undefined };
};

export default function ChatPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatPageInner searchParams={searchParams} />
    </Suspense>
  );
}

async function ChatPageInner({ searchParams }: Props) {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    redirect("/?login=1&error=session_expired");
  }

  const orgIdParam = Array.isArray(searchParams["org_id"]) ? searchParams["org_id"][0] : searchParams["org_id"];
  
  let orgsResp: { organizations: { id: string; name: string }[] };
  try {
    orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }
  const orgs = orgsResp.organizations || [];
  const selectedOrgId = orgIdParam || orgs[0]?.id;

  if (!selectedOrgId) {
    return (
      <div className="text-center py-12">
        <p className="text-mutedForeground mb-4">No organizations found. Create one from the dashboard.</p>
      </div>
    );
  }

  let repos: any[] = [];
  try {
    const reposResp = await backendFetch<{ repositories: any[] }>(`/orgs/${selectedOrgId}/repositories`, token);
    repos = reposResp.repositories || [];
  } catch (e) {
    if (isUnauthorizedBackendError(e)) {
      redirect("/?login=1&error=session_expired");
    }
    throw e;
  }

  return <ChatClient token={token} orgId={selectedOrgId} initialRepos={repos} />;
}

