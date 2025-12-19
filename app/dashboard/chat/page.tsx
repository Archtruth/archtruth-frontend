import { Suspense } from "react";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch } from "@/lib/api/backend";
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
    return <div>Please sign in to chat.</div>;
  }

  const orgsResp = await backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token);
  const orgs = orgsResp.organizations || [];

  const reposByOrg: Record<string, any[]> = {};
  if (orgs.length > 0) {
    const firstOrg = orgs[0].id;
    const reposResp = await backendFetch<{ repositories: any[] }>(`/orgs/${firstOrg}/repositories`, token);
    reposByOrg[firstOrg] = reposResp.repositories || [];
  }

  return <ChatClient token={token} initialOrgs={orgs} initialReposByOrg={reposByOrg} />;
}

