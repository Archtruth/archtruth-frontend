"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  GitBranch,
  RefreshCw,
  Trash2,
  Plus,
  ArrowRight,
  Loader2,
  Eye,
  X,
  Check,
} from "lucide-react";
import { backendFetch } from "@/lib/api/backend-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  initialInstallations: any[];
  initialReposByInstall: Record<number, any[]>;
  initialConnectedRepos: any[];
  initialCapabilities?: any[];
  orgId: string;
  token: string;
};

function getRelativeTime(dateStr?: string) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function ReposList({
  initialInstallations,
  initialReposByInstall,
  initialConnectedRepos,
  initialCapabilities = [],
  orgId,
  token,
}: Props) {
  const [repos, setRepos] = useState(initialConnectedRepos);
  const [connectOpen, setConnectOpen] = useState(false);
  const [selectedToConnect, setSelectedToConnect] = useState<number[]>([]);
  const [capName, setCapName] = useState("");
  const [selectedCapId, setSelectedCapId] = useState<string>("");
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatuses, setSyncStatuses] = useState<Record<number, string>>({});

  const connectedIds = new Set(repos.map((r: any) => r.id));
  const allAvailableRepos = Object.values(initialReposByInstall).flat();
  const unconnectedRepos = allAvailableRepos.filter((r: any) => !connectedIds.has(r.id));

  // Group repos by account_login
  const groupedRepos = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const install of initialInstallations) {
      const installRepos = repos.filter((r: any) =>
        r.github_installation_id === install.installation_id || r.account_login === install.account_login
      );
      if (installRepos.length > 0) {
        groups[install.account_login || "Personal"] = [
          ...(groups[install.account_login || "Personal"] || []),
          ...installRepos,
        ];
      }
    }
    // Add any repos not matched to an installation
    const groupedIds = new Set(Object.values(groups).flat().map((r) => r.id));
    const ungrouped = repos.filter((r: any) => !groupedIds.has(r.id));
    if (ungrouped.length > 0) {
      groups["Repositories"] = [...(groups["Repositories"] || []), ...ungrouped];
    }
    if (Object.keys(groups).length === 0 && repos.length > 0) {
      groups["Repositories"] = repos;
    }
    return groups;
  }, [repos, initialInstallations]);

  async function handleConnect() {
    if (selectedToConnect.length === 0) return;
    if (!selectedCapId && !capName.trim()) {
      toast.error("Select or create a capability first");
      return;
    }
    setConnecting(true);
    try {
      let capId = selectedCapId;
      if (!capId && capName.trim()) {
        const created = await backendFetch<{ capability: { id: string } }>(`/orgs/${orgId}/capabilities`, token, {
          method: "POST",
          body: JSON.stringify({ name: capName.trim() }),
        });
        capId = created.capability.id;
      }

      const installId = initialInstallations[0]?.installation_id;
      for (const repoId of selectedToConnect) {
        const repo = allAvailableRepos.find((r: any) => r.id === repoId);
        if (!repo) continue;
        const connected = await backendFetch<{ repo_id: number }>("/installations/connect-repo", token, {
          method: "POST",
          body: JSON.stringify({
            installation_id: installId,
            github_repo_id: repo.id,
            full_name: repo.full_name,
          }),
        });
        if (capId) {
          try {
            await backendFetch(`/orgs/${orgId}/capabilities/${capId}/services`, token, {
              method: "POST",
              body: JSON.stringify({ repository_id: connected.repo_id }),
            });
          } catch {}
        }
      }

      // Refresh repos
      const resp = await backendFetch<{ repositories: any[] }>(`/orgs/${orgId}/repositories`, token);
      setRepos(resp.repositories || []);
      setConnectOpen(false);
      setSelectedToConnect([]);
      setCapName("");
      toast.success(`Connected ${selectedToConnect.length} repositories`);
    } catch (e: any) {
      toast.error(e.message || "Failed to connect");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect(repoId: number) {
    setDisconnecting(repoId);
    try {
      await backendFetch(`/installations/disconnect-repo/${repoId}`, token, { method: "DELETE" });
      setRepos((prev: any[]) => prev.filter((r) => r.id !== repoId));
      toast.success("Repository disconnected");
    } catch (e: any) {
      toast.error(e.message || "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  async function handleCheckUpdates() {
    setSyncing(true);
    try {
      const resp = await backendFetch<{ sync_statuses: any[] }>(`/orgs/${orgId}/repositories/sync-status`, token);
      const statuses: Record<number, string> = {};
      for (const s of resp.sync_statuses || []) {
        statuses[s.repo_id] = s.status;
      }
      setSyncStatuses(statuses);
    } catch {
      toast.error("Failed to check updates");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRetry(repoId: number) {
    try {
      await backendFetch(`/orgs/${orgId}/repositories/${repoId}/queue`, token, {
        method: "POST",
        body: JSON.stringify({ job_type: "full_scan" }),
      });
      toast.success("Scan queued");
    } catch (e: any) {
      toast.error(e.message || "Failed to queue scan");
    }
  }

  function getStatusBadge(repo: any) {
    const job = repo.latest_job;
    if (!job) return <Badge variant="secondary">No scans</Badge>;
    if (job.status === "completed") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">Ready</Badge>;
    if (job.status === "processing" || job.status === "pending") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 animate-pulse">Scanning</Badge>;
    if (job.status === "failed") return <Badge variant="destructive">Failed</Badge>;
    return <Badge variant="secondary">{job.status}</Badge>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Repositories</h1>
          <p className="text-muted-foreground mt-1">Manage connected repositories</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleCheckUpdates} disabled={syncing} className="gap-1.5">
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Check for Updates
          </Button>
          <Button size="sm" onClick={() => setConnectOpen(true)} className="gap-1.5" disabled={initialInstallations.length === 0}>
            <Plus className="h-3.5 w-3.5" /> Connect Repository
          </Button>
        </div>
      </div>

      {repos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground mb-4">No repositories connected yet.</p>
          {initialInstallations.length > 0 ? (
            <Button onClick={() => setConnectOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Connect your first repository
            </Button>
          ) : (
            <Link href={`/dashboard/connect-github?org_id=${orgId}`}>
              <Button className="gap-1.5">Install GitHub App</Button>
            </Link>
          )}
        </div>
      )}

      {Object.entries(groupedRepos).map(([group, groupRepos]) => (
        <div key={group}>
          {Object.keys(groupedRepos).length > 1 && (
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{group}</h2>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
            {groupRepos.map((repo: any) => {
              const repoName = repo.full_name?.split("/").pop() || repo.full_name;
              const isReady = repo.latest_job?.status === "completed";
              const isFailed = repo.latest_job?.status === "failed";
              const syncStatus = syncStatuses[repo.id];
              return (
                <Card key={repo.id} className="hover:shadow-md transition-shadow duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-sm font-bold shrink-0">
                        {repoName?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{repoName}</span>
                          {getStatusBadge(repo)}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
                          <GitBranch className="h-3 w-3" />
                          {repo.default_branch || "main"}
                          {repo.latest_job?.updated_at && (
                            <><span>·</span><span>{getRelativeTime(repo.latest_job.updated_at)}</span></>
                          )}
                        </div>
                        {syncStatus === "update_available" && (
                          <Badge className="mt-1.5 bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800">Update available</Badge>
                        )}
                        {isFailed && repo.latest_job?.error_message && (
                          <p className="text-xs text-destructive mt-1.5 truncate">{repo.latest_job.error_message}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
                      {isReady && (
                        <Link href={`/dashboard/wiki?org_id=${orgId}&repo=${repo.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                            <Eye className="h-3.5 w-3.5" /> View Wiki
                          </Button>
                        </Link>
                      )}
                      {isReady && (
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleRetry(repo.id)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Sync
                        </Button>
                      )}
                      {isFailed && (
                        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => handleRetry(repo.id)}>
                          <RefreshCw className="h-3.5 w-3.5" /> Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => handleDisconnect(repo.id)}
                        disabled={disconnecting === repo.id}
                      >
                        {disconnecting === repo.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* Connect Repository Modal */}
      <Modal open={connectOpen} onOpenChange={setConnectOpen} title="Connect Repository">
        <div className="space-y-4">
          {unconnectedRepos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">All available repositories are already connected.</p>
          ) : (
            <>
              <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
                {unconnectedRepos.map((repo: any) => (
                  <label key={repo.id} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-accent cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedToConnect.includes(repo.id)}
                      onChange={() => {
                        setSelectedToConnect((prev) =>
                          prev.includes(repo.id) ? prev.filter((id) => id !== repo.id) : [...prev, repo.id]
                        );
                      }}
                      className="rounded"
                    />
                    <span className="text-sm font-medium flex-1">{repo.full_name?.split("/").pop()}</span>
                    <span className="text-xs text-muted-foreground">{repo.default_branch || "main"}</span>
                  </label>
                ))}
              </div>

              {selectedToConnect.length > 0 && (
                <div className="space-y-2 border-t pt-3">
                  <label className="text-sm font-medium">Assign to capability</label>
                  {initialCapabilities && initialCapabilities.length > 0 && (
                    <select
                      value={selectedCapId}
                      onChange={(e) => { setSelectedCapId(e.target.value); setCapName(""); }}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      <option value="">Create new...</option>
                      {initialCapabilities.map((cap: any) => (
                        <option key={cap.id} value={cap.id}>{cap.name}</option>
                      ))}
                    </select>
                  )}
                  {!selectedCapId && (
                    <Input
                      placeholder="New capability name..."
                      value={capName}
                      onChange={(e) => setCapName(e.target.value)}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConnectOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedToConnect.length === 0 || (!selectedCapId && !capName.trim()) || connecting}
              onClick={handleConnect}
              className="gap-1.5"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Connect & Scan
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
