"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { backendFetch } from "@/lib/api/backend";
import { Loader } from "@/components/ui/loader";
import { CheckCircle2, Circle, Clock, AlertCircle, RefreshCw } from "lucide-react";

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

  // Poll for updates on connected repos
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await backendFetch<{ repositories: ConnectedRepo[] }>(
          `/orgs/${orgId}/repositories`,
          token
        );
        if (res.repositories) {
          setConnectedRepos(res.repositories);
        }
      } catch (e) {
        console.error("Failed to poll repos", e);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [orgId, token]);

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

  const getRepoStatus = (repoId: number) => {
    const connected = connectedRepos.find((r) => r.github_repo_id === repoId);
    if (!connected) return null;
    return connected.latest_job?.status || "connected";
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
                                <Button size="sm" variant="outline" disabled>
                                    Connected
                                </Button>
                                <Button size="sm" onClick={() => router.push(`/dashboard/repos/${repo.id}/docs`)}>
                                    View Docs
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
    </div>
  );
}

