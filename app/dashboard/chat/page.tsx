import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, isUnauthorizedBackendError } from "@/lib/api/backend";
import { ChatClient } from "./chat-client";

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}

async function ChatPageInner() {
  const session = await getServerSession();
  const token = session?.access_token;
  if (!token) {
    redirect("/?login=1&error=session_expired");
  }

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

  const reposByOrg: Record<string, any[]> = {};
  if (orgs.length > 0) {
    const firstOrg = orgs[0].id;
    try {
      const reposResp = await backendFetch<{ repositories: any[] }>(`/orgs/${firstOrg}/repositories`, token);
      reposByOrg[firstOrg] = reposResp.repositories || [];
    } catch (e) {
      if (isUnauthorizedBackendError(e)) {
        redirect("/?login=1&error=session_expired");
      }
      throw e;
    }
  }

  return <ChatClient token={token} initialOrgs={orgs} initialReposByOrg={reposByOrg} />;
}

