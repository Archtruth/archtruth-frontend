"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Book, Check, ChevronRight, Github, Loader2, Plus } from "lucide-react";
import { backendFetch } from "@/lib/api/backend-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  githubOrgs: any[];
  token: string;
  providerToken?: string;
};

export function OnboardingClient({ githubOrgs, token, providerToken }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);
  const [installations, setInstallations] = useState<any[]>([]);
  const [availableRepos, setAvailableRepos] = useState<any[]>([]);
  const [selectedRepos, setSelectedRepos] = useState<number[]>([]);
  const [capabilityName, setCapabilityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectedCount, setConnectedCount] = useState(0);

  const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || "#";

  async function handleSelectOrg(org: any) {
    setSelectedOrg(org);
    setLoading(true);

    try {
      if (org.status === "onboarded" && org.archtruth_org_id) {
        // Auto-join existing workspace
        await backendFetch(`/github/orgs/${encodeURIComponent(org.github_login)}/join`, token, {
          method: "POST",
          headers: providerToken ? { "X-GitHub-Token": providerToken } : {},
        });
        router.push("/dashboard");
        return;
      }

      // Create workspace
      const created = await backendFetch<{ organization_id: string }>("/orgs", token, {
        method: "POST",
        body: JSON.stringify({ name: org.github_login }),
      });
      const orgId = created.organization_id;
      setCreatedOrgId(orgId);

      // Check for existing installations
      const installResp = await backendFetch<{ installations: any[] }>(`/orgs/${orgId}/installations`, token);
      const installs = installResp.installations || [];
      setInstallations(installs);

      if (installs.length > 0) {
        // App already installed, fetch repos
        const reposResp = await backendFetch<{ repositories: any[] }>(
          `/installations/${installs[0].installation_id}/repos`, token
        );
        setAvailableRepos(reposResp.repositories || []);
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to set up workspace");
    } finally {
      setLoading(false);
    }
  }

  function handleInstallGitHub() {
    if (!createdOrgId) return;
    window.location.href = `${installUrl}?state=${encodeURIComponent(createdOrgId)}`;
  }

  function toggleRepo(repoId: number) {
    setSelectedRepos((prev) =>
      prev.includes(repoId) ? prev.filter((id) => id !== repoId) : [...prev, repoId]
    );
  }

  function toggleAll() {
    if (selectedRepos.length === availableRepos.length) {
      setSelectedRepos([]);
    } else {
      setSelectedRepos(availableRepos.map((r) => r.id));
    }
  }

  async function handleConnectAndScan() {
    if (!createdOrgId || selectedRepos.length === 0 || !capabilityName.trim()) return;
    setConnecting(true);
    setConnectedCount(0);

    try {
      // Create capability
      const cap = await backendFetch<{ id: string }>(`/orgs/${createdOrgId}/capabilities`, token, {
        method: "POST",
        body: JSON.stringify({ name: capabilityName.trim() }),
      });

      // Connect repos
      const installId = installations[0]?.installation_id;
      for (const repoId of selectedRepos) {
        const repo = availableRepos.find((r) => r.id === repoId);
        if (!repo) continue;

        await backendFetch("/installations/connect-repo", token, {
          method: "POST",
          body: JSON.stringify({
            installation_id: installId,
            repo_id: repo.id,
            full_name: repo.full_name,
            default_branch: repo.default_branch || "main",
            organization_id: createdOrgId,
          }),
        });

        // Assign to capability
        try {
          await backendFetch(`/orgs/${createdOrgId}/capabilities/${cap.id}/services`, token, {
            method: "POST",
            body: JSON.stringify({ repository_id: repo.id }),
          });
        } catch {
          // Non-fatal
        }

        setConnectedCount((c) => c + 1);
      }

      setStep(4);
    } catch (e: any) {
      toast.error(e.message || "Failed to connect repos");
    } finally {
      setConnecting(false);
    }
  }

  const steps = [
    { num: 1, label: "Choose Org" },
    { num: 2, label: "Install App" },
    { num: 3, label: "Connect Repos" },
    { num: 4, label: "Done" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Book className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">ArchTruth</span>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 mb-8">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors",
                  step > s.num ? "bg-primary text-primary-foreground" :
                  step === s.num ? "bg-primary text-primary-foreground" :
                  "bg-muted text-muted-foreground"
                )}
              >
                {step > s.num ? <Check className="h-4 w-4" /> : s.num}
              </div>
              <span className={cn("text-sm hidden sm:inline", step === s.num ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: Choose Org */}
        {step === 1 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-2xl font-semibold text-center">Welcome to ArchTruth</h2>
              <p className="text-center text-muted-foreground">Choose a GitHub organization to document</p>
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
              {!loading && githubOrgs.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No GitHub organizations found. Sign out and sign in again to grant org access.</p>
              )}
              {!loading && githubOrgs.map((org) => (
                <button
                  key={org.github_login}
                  onClick={() => handleSelectOrg(org)}
                  className="flex w-full items-center gap-3 rounded-xl border p-4 text-left hover:bg-accent transition-colors"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-bold text-sm">
                    {org.github_login?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{org.github_login}</div>
                    {org.status === "onboarded" && <p className="text-sm text-muted-foreground">Already on ArchTruth — join workspace</p>}
                    {org.status === "connected" && <p className="text-sm text-muted-foreground">Connected</p>}
                  </div>
                  {org.status === "onboarded" && <Badge variant="secondary">Join</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Install GitHub App */}
        {step === 2 && (
          <Card>
            <CardContent className="p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                  <Github className="h-7 w-7 text-primary" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold">Install GitHub App</h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                ArchTruth needs read-only access to your repositories to analyze code and generate documentation.
              </p>
              <Button size="lg" onClick={handleInstallGitHub} className="gap-2">
                <Github className="h-4 w-4" /> Install on GitHub
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Connect Repos */}
        {step === 3 && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-2xl font-semibold">Connect Repositories</h2>
              <p className="text-muted-foreground">Select repos to document and assign them to a capability</p>
              <div className="flex items-center justify-between">
                <button onClick={toggleAll} className="text-sm text-primary hover:underline">
                  {selectedRepos.length === availableRepos.length ? "Deselect all" : "Select all"}
                </button>
                <span className="text-sm text-muted-foreground">{selectedRepos.length} selected</span>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-1 border rounded-lg p-2">
                {availableRepos.map((repo) => (
                  <label key={repo.id} className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedRepos.includes(repo.id)}
                      onChange={() => toggleRepo(repo.id)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium flex-1">{repo.full_name?.split("/").pop()}</span>
                    <span className="text-xs text-muted-foreground">{repo.default_branch || "main"}</span>
                  </label>
                ))}
                {availableRepos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No repositories found on this installation.</p>
                )}
              </div>

              {selectedRepos.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <label className="text-sm font-medium">Assign to capability</label>
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      placeholder="e.g. Payments, Authentication, Core..."
                      value={capabilityName}
                      onChange={(e) => setCapabilityName(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Create a business domain to group these services. You can reorganize later.</p>
                </div>
              )}

              <Button
                size="lg"
                className="w-full gap-2"
                disabled={selectedRepos.length === 0 || !capabilityName.trim() || connecting}
                onClick={handleConnectAndScan}
              >
                {connecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connecting ({connectedCount}/{selectedRepos.length})...</>
                ) : (
                  <>Connect & Scan <ChevronRight className="h-4 w-4" /></>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <Card>
            <CardContent className="p-6 space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                  <Check className="h-7 w-7 text-emerald-600" />
                </div>
              </div>
              <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
              <p className="text-muted-foreground">
                Your documentation is being generated for {connectedCount} {connectedCount === 1 ? "repository" : "repositories"}.
              </p>
              <Button size="lg" onClick={() => router.push("/dashboard")} className="gap-2">
                Go to Dashboard <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
