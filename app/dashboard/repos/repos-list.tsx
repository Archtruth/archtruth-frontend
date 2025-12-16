"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Modal } from "@/components/ui/modal";
import { backendFetch, disconnectRepo } from "@/lib/api/backend";
import { Loader } from "@/components/ui/loader";
import { CheckCircle2, Circle, Clock, AlertCircle, RefreshCw, X } from "lucide-react";

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
    status: "pending" | "processing" | "completed" | "failed";
    job_type: string;
    created_at: string;
  };
};

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
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [repoToDisconnect, setRepoToDisconnect] = useState<{ id: number; full_name: string } | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const hasTransientRepoState = connectedRepos.some((r) => {
    const s = r.latest_job?.status;
    return s === "pending" || s === "processing";
  });
  const hasConnecting = Object.values(connectingMap).some(Boolean);
  const shouldPoll = hasTransientRepoState || hasConnecting;

  // Poll for updates only when something is in a transient state
  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;

    async function pollOnce() {
      try {
        const res = await backendFetch<{ repositories: ConnectedRepo[] }>(`/orgs/${orgId}/repositories`, token);
        if (!cancelled && res.repositories) {
          setConnectedRepos(res.repositories);
        }
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
    setConnectingMap((prev) => ({ ...prev, [repo.id]: true }));
    try {
      await backendFetch("/installations/connect-repo", token, {
        method: "POST",
        body: JSON.stringify({
          installation_id: installId,
          github_repo_id: repo.id,
          full_name: repo.full_name,
        }),
      });
      // Trigger an immediate poll or wait for next interval
    } catch (e) {
      console.error("Failed to connect repo", e);
      alert("Failed to connect repository");
    } finally {
      // We keep the connecting state until we see it in the connected list (handled by polling)
      // or timeout. But for now, let's clear it after a short delay if it's not "connected" yet.
      // Actually better: keep it true until the repo appears in connectedRepos.
      setTimeout(() => {
           setConnectingMap((prev) => ({ ...prev, [repo.id]: false }));
      }, 2000);
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
                                 <StatusBadge status={status} />
                             ) : isConnecting ? (
                                 <Badge variant="outline" className="gap-1"><Loader className="h-3 w-3" /> Connecting...</Badge>
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
                              <Button 
                                size="sm" 
                                onClick={() => handleConnect(install.installation_id, repo)}
                                loading={isConnecting}
                                disabled={isConnecting}
                              >
                                Connect & Queue
                              </Button>
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

