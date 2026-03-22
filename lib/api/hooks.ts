"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  backendFetch,
  listDocuments,
  presignDocument,
  listOrgRepositories,
  listOrgDocuments,
  presignOrgDocument,
  listWikiPages,
  presignWikiPage,
  listIngestionTasks,
  disconnectRepo,
  cancelIngestionJob,
  deleteWorkspace,
  getDashboardData,
  getWikiData,
  createCapability,
  updateCapability,
  deleteCapability,
  assignServiceToCapability,
  unassignServiceFromCapability,
} from "@/lib/api/backend-client";

// ── Query key factories ──

export const queryKeys = {
  orgs: () => ["orgs"] as const,
  orgRepos: (orgId: string) => ["orgs", orgId, "repositories"] as const,
  orgInstallations: (orgId: string) => ["orgs", orgId, "installations"] as const,
  orgDocs: (orgId: string) => ["org-docs", orgId] as const,
  orgDocContent: (orgId: string, fileName: string) => ["org-docs", orgId, "content", fileName] as const,
  repos: () => ["repos"] as const,
  repoWikiPages: (repoId: number) => ["wiki", repoId, "pages"] as const,
  wikiPageContent: (repoId: number, slug: string) => ["wiki", repoId, "content", slug] as const,
  repoDocs: (repoId: number) => ["documents", repoId] as const,
  docContent: (docId: number) => ["documents", "content", docId] as const,
  ingestionTasks: (repoId: number) => ["ingestion", repoId] as const,
  githubOrgs: () => ["github-orgs"] as const,
  syncStatus: (orgId: string) => ["sync-status", orgId] as const,
  capabilities: (orgId: string) => ["capabilities", orgId] as const,
};

// ── Hooks ──

export function useOrgs(token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orgs(),
    queryFn: () =>
      backendFetch<{ organizations: { id: string; name: string }[] }>("/orgs", token),
    enabled: !!token,
    staleTime: 60 * 1000,
  });
}

export function useOrgRepos(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orgRepos(orgId!),
    queryFn: () =>
      backendFetch<{ repositories: any[] }>(`/orgs/${orgId}/repositories`, token),
    enabled: !!orgId && !!token,
    staleTime: 30 * 1000,
  });
}

export function useOrgInstallations(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orgInstallations(orgId!),
    queryFn: () =>
      backendFetch<{ installations: any[] }>(`/orgs/${orgId}/installations`, token),
    enabled: !!orgId && !!token,
    staleTime: 60 * 1000,
  });
}

export function useOrgDocs(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.orgDocs(orgId!),
    queryFn: () => listOrgDocuments(orgId!, token!),
    enabled: !!orgId && !!token,
    staleTime: 60 * 1000,
  });
}

export function useOrgDocContent(
  orgId: string | undefined,
  fileName: string | undefined,
  token: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.orgDocContent(orgId!, fileName!),
    queryFn: async () => {
      const presigned = await presignOrgDocument(orgId!, fileName!, token!);
      const resp = await fetch(presigned.url, { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed to fetch org document");
      return resp.text();
    },
    enabled: !!orgId && !!fileName && !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRepoDocs(repoId: number | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.repoDocs(repoId!),
    queryFn: () => listDocuments(repoId!, token!),
    enabled: !!repoId && !!token,
    staleTime: 60 * 1000,
  });
}

export function useDocContent(docId: number | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.docContent(docId!),
    queryFn: async () => {
      const presigned = await presignDocument(docId!, token!);
      const resp = await fetch(presigned.url, { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed to fetch document");
      return resp.text();
    },
    enabled: !!docId && !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useWikiPages(repoId: number | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.repoWikiPages(repoId!),
    queryFn: () => listWikiPages(repoId!, token!),
    enabled: !!repoId && !!token,
    staleTime: 60 * 1000,
  });
}

export function useWikiPageContent(
  repoId: number | undefined,
  slug: string | undefined,
  token: string | null | undefined
) {
  return useQuery({
    queryKey: queryKeys.wikiPageContent(repoId!, slug!),
    queryFn: async () => {
      const presigned = await presignWikiPage(repoId!, slug!, token!);
      const resp = await fetch(presigned.url, { cache: "no-store" });
      if (!resp.ok) throw new Error("Failed to fetch wiki page");
      return resp.text();
    },
    enabled: !!repoId && !!slug && !!token,
    staleTime: 5 * 60 * 1000,
  });
}

export function useIngestionTasks(
  repoId: number | undefined,
  token: string | null | undefined,
  enabled = true
) {
  return useQuery({
    queryKey: queryKeys.ingestionTasks(repoId!),
    queryFn: () => listIngestionTasks(repoId!, token!),
    enabled: !!repoId && !!token && enabled,
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
  });
}

export function useSyncStatus(orgId: string | undefined, token: string | null | undefined, enabled = false) {
  return useQuery({
    queryKey: queryKeys.syncStatus(orgId!),
    queryFn: () =>
      backendFetch<{ sync_statuses: { repo_id: number; status: string; current_head?: string; last_ingested?: string }[] }>(
        `/orgs/${orgId}/repositories/sync-status`,
        token
      ),
    enabled: !!orgId && !!token && enabled,
    staleTime: 30 * 1000,
  });
}

export function useCapabilities(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.capabilities(orgId!),
    queryFn: () =>
      backendFetch<{ capabilities: any[] }>(`/orgs/${orgId}/capabilities`, token),
    enabled: !!orgId && !!token,
    staleTime: 60 * 1000,
  });
}

// ── Mutations ──

export function useDisconnectRepo(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repoId: number) => disconnectRepo(repoId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orgs"] });
    },
  });
}

export function useCancelIngestionJob(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: number) => cancelIngestionJob(jobId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ingestion"] });
    },
  });
}

export function useQueueRepo(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ repoId, jobType = "full_scan" }: { repoId: number; jobType?: string }) =>
      backendFetch(`/orgs/${orgId}/repositories/${repoId}/queue`, token, {
        method: "POST",
        body: JSON.stringify({ job_type: jobType }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgRepos(orgId!) });
      qc.invalidateQueries({ queryKey: queryKeys.syncStatus(orgId!) });
    },
  });
}

export function useDashboardData(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: ["dashboard-data", orgId] as const,
    queryFn: () => getDashboardData(orgId!, token!),
    enabled: !!orgId && !!token,
    staleTime: 30 * 1000,
  });
}

export function useWikiData(orgId: string | undefined, token: string | null | undefined) {
  return useQuery({
    queryKey: ["wiki-data", orgId] as const,
    queryFn: () => getWikiData(orgId!, token!),
    enabled: !!orgId && !!token,
    staleTime: 60 * 1000,
  });
}

export function useDeleteWorkspace(token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orgId: string) => deleteWorkspace(orgId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orgs() });
    },
  });
}

export function useCreateCapability(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; parent_capability_id?: string }) =>
      createCapability(orgId!, data, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.capabilities(orgId!) });
    },
  });
}

export function useUpdateCapability(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ capId, data }: { capId: string; data: { name?: string; description?: string } }) =>
      updateCapability(orgId!, capId, data, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.capabilities(orgId!) });
    },
  });
}

export function useDeleteCapability(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (capId: string) => deleteCapability(orgId!, capId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.capabilities(orgId!) });
    },
  });
}

export function useAssignService(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ capId, repoId }: { capId: string; repoId: number }) =>
      assignServiceToCapability(orgId!, capId, repoId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.capabilities(orgId!) });
    },
  });
}

export function useUnassignService(orgId: string | undefined, token: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ capId, repoId }: { capId: string; repoId: number }) =>
      unassignServiceFromCapability(orgId!, capId, repoId, token!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.capabilities(orgId!) });
    },
  });
}
