"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import {
  backendFetch,
  disconnectRepo,
  isBackendError,
  listIngestionTasks,
  cancelIngestionJob,
} from "@/lib/api/backend-client";
import { Loader } from "@/components/ui/loader";
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  RefreshCw,
  X,
  ListChecks,
  StopCircle,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Repo = {
  id: number;
  full_name: string;
  default_branch: string;
};

type ConnectedRepo = {
  id: number;
  github_repo_id: number;
  full_name: string;
  latest_job?: {
    id?: number; // Backend exposes this now
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    job_type: string;
    created_at: string;
  };
};

type IngestionTask = {
  id: number;
  stage: string;
  status: string;
  started_at: string;
};

function IngestionStatusPopover({ repoId, token, jobId }: { repoId: number; token: string; jobId?: number }) {
  const [tasks, setTasks] = useState<IngestionTask[]>([]);
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!open) return;
    listIngestionTasks(repoId, token).then((res) => {
      setTasks(res.tasks || []);
    });
    const interval = setInterval(() => {
      listIngestionTasks(repoId, token).then((res) => {
        setTasks(res.tasks || []);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, [open, repoId, token]);

  const handleCancel = async () => {
    if (!jobId) return;
    if (!confirm("Are you sure you want to cancel this job?")) return;
    setCancelling(true);
    try {
      await cancelIngestionJob(jobId, token);
    } catch (e) {
      console.error("Failed to cancel job", e);
      alert("Failed to cancel job.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
          <ListChecks className="h-4 w-4 text-muted-foreground hover:text-primary" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/10 flex justify-between items-center">
          <h4 className="font-medium text-sm">Ingestion Progress</h4>
          {jobId && (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={handleCancel}
              disabled={cancelling}
            >
              <StopCircle className="h-3 w-3 mr-1" />
              Cancel
            </Button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto p-2 space-y-1">
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">Waiting for tasks to start...</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-xs p-2 rounded hover:bg-muted/50">
                <span className="capitalize font-medium text-foreground/80">
                  {t.stage.replace(/_/g, " ")}
                </span>
                <span
                  className={
                    t.status === "completed"
                      ? "text-green-600"
                      : t.status === "failed"
                      ? "text-red-600"
                      : "text-blue-600 animate-pulse"
                  }
                >
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type Installation = {
  installation_id: number;
  account_login: string;
};

type Props = {
  initialInstallations: Installation[];
  initialReposByInstall: Record<number, Repo[]>;
  initialConnectedRepos: ConnectedRepo[];
  orgId: string;
  token: string;
};

export function ReposList({
  initialInstallations,
  initialReposByInstall,
  initialConnectedRepos,
  orgId,
  token,
}: Props) {
  const router = useRouter();
  const [connectedRepos, setConnectedRepos] = useState<ConnectedRepo[]>(initialConnectedRepos);
  const [connectingMap, setConnectingMap] = useState<Record<number, boolean>>({});
  const [connectErrorMap, setConnectErrorMap] = useState<Record<number, string>>({});
  const [retryQueueMap, setRetryQueueMap] = useState<Record<number, boolean>>({}); // keyed by connected repo internal id
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [repoToDisconnect, setRepoToDisconnect] = useState<{ id: number; full_name: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  // Sync state when orgId changes and new initial data comes in
  useEffect(() => {
    setConnectedRepos(initialConnectedRepos);
    setConnectingMap({});
    setConnectErrorMap({});
    setRetryQueueMap({});
  }, [orgId, initialConnectedRepos]);

  const fetchRepos = async () => {
    const res = await backendFetch<{ repositories: ConnectedRepo[] }>(`/orgs/${orgId}/repositories`, token);
    if (res.repositories) setConnectedRepos(res.repositories);
  };

  const hasTransientRepoState = connectedRepos.some((r) => {
    const s = r.latest_job?.status;
    return s === "pending" || s === "processing";
  });
  const hasConnecting = Object.values(connectingMap).some(Boolean);
  const shouldPoll = hasTransientRepoState || hasConnecting;

  // Clear connecting flags once the repo appears in connectedRepos (don't unlock after a fixed timeout).
  useEffect(() => {
    setConnectingMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [githubRepoIdStr, val] of Object.entries(prev)) {
        if (!val) continue;
        const githubRepoId = Number(githubRepoIdStr);
        if (connectedRepos.some((r) => r.github_repo_id === githubRepoId)) {
          next[githubRepoId] = false;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [connectedRepos]);

  // Poll for updates only when something is in a transient state
  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;

    async function pollOnce() {
      try {
        const res = await backendFetch<{ repositories: ConnectedRepo[] }>(`/orgs/${orgId}/repositories`, token);
        if (!cancelled && res.repositories) setConnectedRepos(res.repositories);
      } catch (e) {
        console.error("Failed to poll repos", e);
      }
    }

    // Fetch immediately, then keep polling.
    pollOnce();
    const interval = setInterval(pollOnce, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shouldPoll, orgId, token]);

  const handleConnect = async (installId: number, repo: Repo) => {
    if (connectingMap[repo.id]) return;
    setConnectingMap((prev) => ({ ...prev, [repo.id]: true }));
    setConnectErrorMap((prev) => {
      const next = { ...prev };
      delete next[repo.id];
      return next;
    });
    try {
      const res = await backendFetch<{ repo_id: number }>(`/installations/connect-repo`, token, {
        method: "POST",
        body: JSON.stringify({
          installation_id: installId,
          github_repo_id: repo.id,
          full_name: repo.full_name,
        }),
      });

      // Optimistic: show queued immediately (real status will come from polling/refetch).
      const nowIso = new Date().toISOString();
      setConnectedRepos((prev) => {
        const already = prev.some((r) => r.github_repo_id === repo.id);
        if (already) return prev;
        return [
          ...prev,
          {
            id: res.repo_id,
            github_repo_id: repo.id,
            full_name: repo.full_name,
            latest_job: { status: "pending", job_type: "full_scan", created_at: nowIso },
          },
        ];
      });

      // Fetch immediately so status reflects without waiting for the 5s poll.
      await fetchRepos();
    } catch (e) {
      // If backend says "already queued", treat as success and just refresh.
      if (isBackendError(e) && e.status === 409) {
        await fetchRepos();
        return;
      }
      console.error("Failed to connect repo", e);
      setConnectErrorMap((prev) => ({
        ...prev,
        [repo.id]: e instanceof Error ? e.message : "Failed to connect & queue repository",
      }));
      // Hard failure: unlock so the user can retry.
      setConnectingMap((prev) => ({ ...prev, [repo.id]: false }));
    } finally {
      // Success path: keep connectingMap=true until the repo appears in connectedRepos (effect clears it).
    }
  };

  const handleRetryQueue = async (connectedRepoId: number) => {
    if (retryQueueMap[connectedRepoId]) return;
    setRetryQueueMap((prev) => ({ ...prev, [connectedRepoId]: true }));
    try {
      await backendFetch(`/orgs/${orgId}/repositories/${connectedRepoId}/queue`, token, {
        method: "POST",
        body: JSON.stringify({ job_type: "full_scan" }),
      });
      await fetchRepos();
    } catch (e) {
      // If backend says "already queued", treat as success and just refresh.
      if (isBackendError(e) && e.status === 409) {
        await fetchRepos();
        return;
      }
      console.error("Failed to retry queue", e);
      alert(e instanceof Error ? e.message : "Failed to queue scan. Please try again.");
    } finally {
      setRetryQueueMap((prev) => ({ ...prev, [connectedRepoId]: false }));
    }
  };

  const handleDisconnectClick = (repo: ConnectedRepo) => {
    setRepoToDisconnect({ id: repo.id, full_name: repo.full_name });
    setDisconnectModalOpen(true);
  };

  const handleDisconnectConfirm = async () => {
    if (!repoToDisconnect) return;
    
    setDisconnecting(true);
    try {
      await disconnectRepo(repoToDisconnect.id, token);
      // Remove from local state immediately
      setConnectedRepos((prev) => prev.filter((r) => r.id !== repoToDisconnect.id));
      setDisconnectModalOpen(false);
      setRepoToDisconnect(null);
    } catch (e) {
      console.error("Failed to disconnect repo", e);
      alert("Failed to disconnect repository. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const getRepoStatus = (repoId: number) => {
    const connected = connectedRepos.find((r) => r.github_repo_id === repoId);
    if (!connected) return null;
    return connected.latest_job?.status || "connected";
  };

  const getConnectedRepo = (githubRepoId: number) => {
    return connectedRepos.find((r) => r.github_repo_id === githubRepoId) || null;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1 bg-yellow-50 text-yellow-700 border-yellow-200">
            <Clock className="h-3 w-3" /> Queued
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
            <RefreshCw className="h-3 w-3 animate-spin" /> Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="gap-1 bg-green-50 text-green-700 border-green-200">
            <CheckCircle2 className="h-3 w-3" /> Ready
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
            <AlertCircle className="h-3 w-3" /> Failed
          </Badge>
        );
      default:
        return (
            <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Connected
            </Badge>
        )
    }
  };

  return (
    <div className="space-y-6">
      {initialInstallations.length === 0 ? (
         <div className="text-center py-12">
             <p className="text-mutedForeground mb-4">No GitHub installations found.</p>
             <Button onClick={() => router.push(`/dashboard/connect-github?org_id=${orgId}`)}>
                 Install GitHub App
             </Button>
         </div>
      ) : (
        initialInstallations.map((install) => {
          const repos = initialReposByInstall[install.installation_id] || [];
          return (
            <Card key={install.installation_id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="text-xl">Installation #{install.installation_id}</span>
                    <Badge variant="outline">{install.account_login}</Badge>
                </CardTitle>
                <CardDescription>Manage repositories for this installation.</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <THead>
                    <TR>
                      <TH>Repository</TH>
                      <TH>Default Branch</TH>
                      <TH>Status</TH>
                      <TH className="text-right">Action</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {repos.map((repo) => {
                      const status = getRepoStatus(repo.id);
                      const isConnecting = connectingMap[repo.id];
                      
                      return (
                        <TR key={repo.id}>
                          <TD className="font-medium text-base">{repo.full_name}</TD>
                          <TD className="text-mutedForeground font-mono text-xs">{repo.default_branch || "main"}</TD>
                          <TD>
                             {status ? (
                                 <div className="flex items-center gap-2">
                                   <StatusBadge status={status} />
                                   {(status === "processing" || status === "pending") && getConnectedRepo(repo.id) && (
                                     <IngestionStatusPopover
                                       repoId={getConnectedRepo(repo.id)!.id}
                                       token={token}
                                       jobId={getConnectedRepo(repo.id)?.latest_job?.id}
                                     />
                                   )}
                                 </div>
                             ) : isConnecting ? (
                                 <Badge variant="outline" className="gap-1"><Loader className="h-3 w-3" /> Connecting...</Badge>
                             ) : connectErrorMap[repo.id] ? (
                                 <Badge variant="outline" className="gap-1 bg-red-50 text-red-700 border-red-200">
                                   <AlertCircle className="h-3 w-3" /> Not queued
                                 </Badge>
                             ) : (
                                 <span className="text-mutedForeground text-sm">-</span>
                             )}
                          </TD>
                          <TD className="text-right">
                            {status === "completed" || status === "connected" ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    const connected = getConnectedRepo(repo.id);
                                    if (!connected) {
                                      alert("Repository is connected, but its internal ID wasn't found yet. Please wait a moment and try again.");
                                      return;
                                    }
                                    router.push(`/dashboard/repos/${connected.id}/docs?org_id=${orgId}`);
                                  }}
                                >
                                    View Docs
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const connected = getConnectedRepo(repo.id);
                                    if (!connected) {
                                      alert("Repository is connected, but its internal ID wasn't found yet. Please wait a moment and try again.");
                                      return;
                                    }
                                    router.push(`/dashboard/repos/${connected.id}/wiki?org_id=${orgId}`);
                                  }}
                                >
                                  View Wiki
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const connected = getConnectedRepo(repo.id);
                                    if (connected) {
                                      handleDisconnectClick(connected);
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Disconnect
                                </Button>
                              </div>
                            ) : status === "failed" ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const connected = getConnectedRepo(repo.id);
                                    if (!connected) return;
                                    handleRetryQueue(connected.id);
                                  }}
                                  loading={Boolean(getConnectedRepo(repo.id) && retryQueueMap[getConnectedRepo(repo.id)!.id])}
                                  disabled={Boolean(getConnectedRepo(repo.id) && retryQueueMap[getConnectedRepo(repo.id)!.id])}
                                >
                                  Retry Scan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    const connected = getConnectedRepo(repo.id);
                                    if (connected) {
                                      handleDisconnectClick(connected);
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Disconnect
                                </Button>
                              </div>
                            ) : status ? (
                                <Button size="sm" variant="outline" disabled>
                                    Connected
                                </Button>
                            ) : (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  onClick={() => handleConnect(install.installation_id, repo)}
                                  loading={isConnecting}
                                  disabled={isConnecting}
                                >
                                  {connectErrorMap[repo.id] ? "Retry Connect & Queue" : "Connect & Queue"}
                                </Button>
                              </div>
                            )}
                          </TD>
                        </TR>
                      );
                    })}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          );
        })
      )}

      <Modal
        open={disconnectModalOpen}
        onOpenChange={setDisconnectModalOpen}
        title="Disconnect Repository"
        disabled={disconnecting}
      >
        <div className="space-y-4">
          {disconnecting ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm font-medium">Disconnecting repository...</p>
              <p className="text-xs text-mutedForeground mt-1">Please wait while we remove all data.</p>
            </div>
          ) : (
            <>
              <div className="text-sm text-mutedForeground">
                <p className="mb-2">
                  Are you sure you want to disconnect <span className="font-semibold text-foreground">{repoToDisconnect?.full_name}</span>?
                </p>
                <p className="text-destructive font-medium">
                  ⚠️ Warning: This will permanently delete all documentation and chunks for this repository. This action cannot be undone.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDisconnectModalOpen(false);
                    setRepoToDisconnect(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnectConfirm}
                >
                  Disconnect Repository
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

