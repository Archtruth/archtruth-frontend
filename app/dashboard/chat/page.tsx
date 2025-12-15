import { Suspense } from "react";
import { getServerSession } from "@/lib/supabase/server";
import { ChatClient } from "./chat-client";

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      {/* @ts-expect-error Async Server Component */}
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
  return <ChatClient token={token} />;
}

