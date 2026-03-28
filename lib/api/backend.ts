const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!backendUrl) {
  throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
}

interface FetchOptions extends RequestInit {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

export class BackendError extends Error {
  status: number;
  bodyText: string;
  bodyJson?: any;

  constructor(status: number, bodyText: string) {
    // Keep the backend payload for debugging, but provide a friendlier message for auth failures.
    const msg =
      status === 401
        ? "Your session has expired. Please sign in again."
        : `Backend error ${status}: ${bodyText}`;
    super(msg);
    this.name = "BackendError";
    this.status = status;
    this.bodyText = bodyText;
    try {
      this.bodyJson = JSON.parse(bodyText);
    } catch {
      // ignore
    }
  }
}

export function isBackendError(e: unknown): e is BackendError {
  return e instanceof BackendError;
}

export function isUnauthorizedBackendError(e: unknown): e is BackendError {
  return isBackendError(e) && e.status === 401;
}

/**
 * Fetch with automatic retry logic for cold starts
 * Handles backend spinning up on Render free tier (can take 60-90 seconds)
 */
async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    maxRetries = 3,
    retryDelay = 3000,
    timeout = 90000,
    ...fetchOptions
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return response;
      }

      // If it's a 5xx error or 502/503 (backend cold starting), retry
      if (
        (response.status >= 500 || response.status === 502 || response.status === 503) &&
        attempt < maxRetries
      ) {
        console.log(
          `Backend cold start detected (${response.status}), retrying in ${retryDelay * (attempt + 1)}ms...`
        );
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelay * (attempt + 1))
        );
        continue;
      }

      return response;
    } catch (error: any) {
      // Network error, timeout, or AbortError
      if (attempt === maxRetries) {
        throw new Error(
          `Backend unavailable after ${maxRetries} retries. Please try again in a moment.`
        );
      }

      console.log(
        `Request failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying...`
      );

      // Exponential backoff: 3s, 6s, 9s
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * (attempt + 1))
      );
    }
  }

  throw new Error("Max retries exceeded");
}

export async function backendFetch<T>(
  path: string,
  token: string | undefined | null,
  init?: RequestInit
): Promise<T> {
  if (!token) {
    throw new Error("Not authenticated: missing Supabase access token");
  }
  
  // If signal is provided, don't retry on abort
  const shouldRetry = !init?.signal;
  
  const resp = await fetchWithRetry(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
    maxRetries: shouldRetry ? 1 : 0,
    retryDelay: 2000,
    timeout: 15000,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new BackendError(resp.status, text);
  }
  return (await resp.json()) as T;
}

export async function listDocuments(repoId: number, token: string) {
  return backendFetch<{
    documents: {
      id: number;
      file_path: string;
      commit_sha?: string;
      r2_url: string;
      updated_at?: string;
    }[];
  }>(`/documents/by-repo/${repoId}`, token);
}

export async function presignDocument(docId: number, token: string) {
  return backendFetch<{ url: string }>(`/documents/${docId}/presigned`, token);
}

export async function listOrgRepositories(orgId: string, token: string) {
  return backendFetch<{
    repositories: { id: number; full_name: string; default_branch?: string }[];
  }>(`/orgs/${orgId}/repositories`, token);
}

export async function listOrgDocuments(orgId: string, token: string) {
  return backendFetch<{
    documents: {
      id: number;
      file_path: string;
      r2_url: string;
      updated_at?: string;
    }[];
  }>(`/org-docs/${orgId}`, token);
}

export async function presignOrgDocument(orgId: string, fileName: string, token: string) {
  return backendFetch<{ url: string }>(`/org-docs/${orgId}/${fileName}/presigned`, token);
}

export async function listOrgCapabilities(orgId: string, token: string) {
  return backendFetch<{
    capabilities: {
      id: string;
      name: string;
      description?: string;
      level: number;
      nav_order: number;
      parent_capability_id?: string;
      children: any[];
      services: { repository_id: number; nav_order: number }[];
    }[];
  }>(`/orgs/${orgId}/capabilities`, token);
}

export async function listWikiPages(repoId: number, token: string) {
  return backendFetch<{
    pages: {
      id: number;
      repo_id: number;
      slug: string;
      title: string;
      category?: string;
      updated_at?: string;
    }[];
  }>(`/wiki/by-repo/${repoId}`, token);
}

export async function presignWikiPage(repoId: number, slug: string, token: string) {
  const encoded = encodeURIComponent(slug);
  return backendFetch<{ url: string }>(`/wiki/by-repo/${repoId}/presigned?slug=${encoded}`, token);
}

export async function disconnectRepo(repoId: number, token: string) {
  return backendFetch<{ message: string; repo_id: number }>(
    `/installations/disconnect-repo/${repoId}`,
    token,
    {
      method: "DELETE",
    }
  );
}

export async function listIngestionTasks(repoId: number, token: string) {
  return backendFetch<{
    tasks: {
      id: number;
      repo_id: number;
      stage: string;
      status: string;
      started_at: string;
      completed_at?: string;
      error_message?: string;
    }[];
  }>(`/ingestion/tasks/${repoId}`, token);
}

export async function cancelIngestionJob(jobId: number, token: string) {
  return backendFetch<{ success: boolean; status: string }>(
    `/ingestion/cancel/${jobId}`,
    token,
    { method: "POST" }
  );
}

export async function deleteWorkspace(orgId: string, token: string) {
  return backendFetch<{ deleted: boolean }>(`/orgs/${orgId}`, token, { method: "DELETE" });
}

export async function getDashboardData(orgId: string, token: string) {
  return backendFetch<{
    repositories: any[];
    org_doc_count: number;
    installation_count: number;
    capability_count: number;
    has_installation: boolean;
  }>(`/orgs/${orgId}/dashboard-data`, token);
}

export async function getWikiData(orgId: string, token: string) {
  return backendFetch<{
    org_documents: any[];
    repositories: {
      id: number;
      full_name: string;
      default_branch: string;
      wiki_pages: { id: number; slug: string; title: string; category: string }[];
    }[];
    capabilities: any[];
  }>(`/orgs/${orgId}/wiki-data`, token);
}

export type CreateCapabilityResponse = {
  capability: {
    id: string;
    name: string;
    description?: string | null;
    parent_capability_id?: string | null;
    level?: number;
    nav_order?: number;
  };
};

export async function createCapability(
  orgId: string,
  data: { name: string; description?: string; parent_capability_id?: string },
  token: string
) {
  return backendFetch<CreateCapabilityResponse>(`/orgs/${orgId}/capabilities`, token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCapability(
  orgId: string,
  capId: string,
  data: { name?: string; description?: string },
  token: string
) {
  return backendFetch<any>(`/orgs/${orgId}/capabilities/${capId}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCapability(orgId: string, capId: string, token: string) {
  return backendFetch<any>(`/orgs/${orgId}/capabilities/${capId}`, token, { method: "DELETE" });
}

export async function assignServiceToCapability(orgId: string, capId: string, repoId: number, token: string) {
  return backendFetch<any>(`/orgs/${orgId}/capabilities/${capId}/services`, token, {
    method: "POST",
    body: JSON.stringify({ repository_id: repoId }),
  });
}

export async function unassignServiceFromCapability(orgId: string, capId: string, repoId: number, token: string) {
  return backendFetch<any>(`/orgs/${orgId}/capabilities/${capId}/services/${repoId}`, token, {
    method: "DELETE",
  });
}

export async function chatStream(
  token: string,
  body: { query: string; repo_ids?: number[]; history?: { role: string; content: string }[] },
  signal?: AbortSignal
): Promise<Response> {
  const resp = await fetch(`${backendUrl}/chat`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    signal,
  });

  // Ensure callers see a consistent error shape (including 401) instead of silently getting an empty stream.
  if (!resp.ok) {
    const text = await resp.text();
    throw new BackendError(resp.status, text);
  }

  return resp;
}

