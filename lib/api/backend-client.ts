"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  backendFetch as backendFetchBase,
  chatStream as chatStreamBase,
  disconnectRepo as disconnectRepoBase,
  listIngestionTasks as listIngestionTasksBase,
  cancelIngestionJob as cancelIngestionJobBase,
  listDocuments as listDocumentsBase,
  presignDocument as presignDocumentBase,
  listOrgRepositories as listOrgRepositoriesBase,
  listOrgDocuments as listOrgDocumentsBase,
  presignOrgDocument as presignOrgDocumentBase,
  listWikiPages as listWikiPagesBase,
  presignWikiPage as presignWikiPageBase,
  deleteWorkspace as deleteWorkspaceBase,
  getDashboardData as getDashboardDataBase,
  getWikiData as getWikiDataBase,
  createCapability as createCapabilityBase,
  updateCapability as updateCapabilityBase,
  deleteCapability as deleteCapabilityBase,
  assignServiceToCapability as assignServiceBase,
  unassignServiceFromCapability as unassignServiceBase,
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

export function listOrgRepositories(orgId: string, token: string) {
  return withAuthRedirect(() => listOrgRepositoriesBase(orgId, token));
}

export function listOrgDocuments(orgId: string, token: string) {
  return withAuthRedirect(() => listOrgDocumentsBase(orgId, token));
}

export function presignOrgDocument(orgId: string, fileName: string, token: string) {
  return withAuthRedirect(() => presignOrgDocumentBase(orgId, fileName, token));
}

export function listWikiPages(repoId: number, token: string) {
  return withAuthRedirect(() => listWikiPagesBase(repoId, token));
}

export function presignWikiPage(repoId: number, slug: string, token: string) {
  return withAuthRedirect(() => presignWikiPageBase(repoId, slug, token));
}

export function disconnectRepo(repoId: number, token: string) {
  return withAuthRedirect(() => disconnectRepoBase(repoId, token));
}

export function listIngestionTasks(repoId: number, token: string) {
  return withAuthRedirect(() => listIngestionTasksBase(repoId, token));
}

export function cancelIngestionJob(jobId: number, token: string) {
  return withAuthRedirect(() => cancelIngestionJobBase(jobId, token));
}

export function deleteWorkspace(orgId: string, token: string) {
  return withAuthRedirect(() => deleteWorkspaceBase(orgId, token));
}

export function getDashboardData(orgId: string, token: string) {
  return withAuthRedirect(() => getDashboardDataBase(orgId, token));
}

export function getWikiData(orgId: string, token: string) {
  return withAuthRedirect(() => getWikiDataBase(orgId, token));
}

export function createCapability(orgId: string, data: { name: string; description?: string; parent_capability_id?: string }, token: string) {
  return withAuthRedirect(() => createCapabilityBase(orgId, data, token));
}

export function updateCapability(orgId: string, capId: string, data: { name?: string; description?: string }, token: string) {
  return withAuthRedirect(() => updateCapabilityBase(orgId, capId, data, token));
}

export function deleteCapability(orgId: string, capId: string, token: string) {
  return withAuthRedirect(() => deleteCapabilityBase(orgId, capId, token));
}

export function assignServiceToCapability(orgId: string, capId: string, repoId: number, token: string) {
  return withAuthRedirect(() => assignServiceBase(orgId, capId, repoId, token));
}

export function unassignServiceFromCapability(orgId: string, capId: string, repoId: number, token: string) {
  return withAuthRedirect(() => unassignServiceBase(orgId, capId, repoId, token));
}

export { isBackendError };
export type { BackendError };


