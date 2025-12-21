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
  const resp = await fetchWithRetry(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
    maxRetries: 3,
    retryDelay: 3000, // 3 seconds between retries
    timeout: 90000, // 90 seconds for cold starts (Render free tier can take 60-90s)
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

export async function disconnectRepo(repoId: number, token: string) {
  return backendFetch<{ message: string; repo_id: number }>(
    `/installations/disconnect-repo/${repoId}`,
    token,
    {
      method: "DELETE",
    }
  );
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

