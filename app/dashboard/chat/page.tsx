import { Suspense } from "react";
import { getServerSession } from "@/lib/supabase/server";
import { backendFetch, listOrgRepos } from "@/lib/api/backend";
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
  const selectedOrgId = orgs[0]?.id;
  const reposResp = selectedOrgId
    ? await listOrgRepos(selectedOrgId, token)
    : { repositories: [] };
  const repos = reposResp.repositories || [];

  return <ChatClient token={token} orgId={selectedOrgId} repos={repos} />;
}

