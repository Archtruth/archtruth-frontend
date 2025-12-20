"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  backendFetch as backendFetchBase,
  chatStream as chatStreamBase,
  disconnectRepo as disconnectRepoBase,
  listDocuments as listDocumentsBase,
  presignDocument as presignDocumentBase,
  isBackendError,
  type BackendError,
} from "@/lib/api/backend";

const LOGIN_REDIRECT_URL = "/?login=1&error=session_expired";

async function handleUnauthorized() {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
  } catch {
    // Ignore sign-out failures; we still want to force a re-login UI.
  }

  // Prevent a noisy redirect loop if we're already on the home/login modal view.
  if (typeof window !== "undefined") {
    const alreadyOnHome = window.location.pathname === "/";
    const hasLogin = new URLSearchParams(window.location.search).get("login") === "1";
    if (!(alreadyOnHome && hasLogin)) {
      window.location.assign(LOGIN_REDIRECT_URL);
    }
  }
}

async function withAuthRedirect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (isBackendError(e) && e.status === 401) {
      await handleUnauthorized();
    }
    throw e;
  }
}

// Client-safe wrappers (use these in "use client" components)
export function backendFetch<T>(path: string, token: string | undefined | null, init?: RequestInit): Promise<T> {
  return withAuthRedirect(() => backendFetchBase<T>(path, token, init));
}

export function chatStream(
  token: string,
  body: { query: string; repo_ids?: number[]; history?: { role: string; content: string }[] },
  signal?: AbortSignal
): Promise<Response> {
  return withAuthRedirect(() => chatStreamBase(token, body, signal));
}

export function listDocuments(repoId: number, token: string) {
  return withAuthRedirect(() => listDocumentsBase(repoId, token));
}

export function presignDocument(docId: number, token: string) {
  return withAuthRedirect(() => presignDocumentBase(docId, token));
}

export function disconnectRepo(repoId: number, token: string) {
  return withAuthRedirect(() => disconnectRepoBase(repoId, token));
}

export { isBackendError };
export type { BackendError };


