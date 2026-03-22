"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { AlertTriangle, Check, ExternalLink, Github, Loader2, Trash2 } from "lucide-react";
import { backendFetch } from "@/lib/api/backend-client";
import { toast } from "sonner";

type Props = {
  orgId: string;
  orgName: string;
  installation: any | null;
  repoCount: number;
  token: string;
  onDeleteAccount?: () => Promise<void> | void;
};

export function SettingsClient({ orgId, orgName, installation, repoCount, token, onDeleteAccount }: Props) {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [accountDeleteOpen, setAccountDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const installUrl = process.env.NEXT_PUBLIC_GITHUB_APP_INSTALL_URL || "#";

  async function handleDeleteWorkspace() {
    if (deleteConfirm !== orgName) return;
    setDeleting(true);
    try {
      await backendFetch(`/orgs/${orgId}`, token, { method: "DELETE" });
      toast.success("Workspace deleted");
      router.push("/onboarding");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete workspace");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-semibold">Settings</h1>

      {/* Workspace Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Name</span>
            <span className="font-medium">{orgName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Repositories</span>
            <span className="font-medium">{repoCount} connected</span>
          </div>
        </CardContent>
      </Card>

      {/* GitHub Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Github className="h-4 w-4" />
            GitHub Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {installation ? (
            <>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">
                  GitHub App installed on <span className="font-medium">{installation.account_login}</span>
                </span>
              </div>
              <div className="flex gap-2">
                <a href={`https://github.com/settings/installations/${installation.installation_id}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    Manage on GitHub <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No GitHub App installation found for this workspace.</p>
              <a href={`${installUrl}?state=${encodeURIComponent(orgId)}`}>
                <Button size="sm">
                  Install GitHub App
                </Button>
              </a>
            </>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div>
              <div className="font-medium">Delete Workspace</div>
              <p className="text-sm text-muted-foreground mt-1">
                Permanently delete this workspace, all repos, documentation, and embeddings.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete...
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-destructive/20 p-4">
            <div>
              <div className="font-medium">Delete Account</div>
              <p className="text-sm text-muted-foreground mt-1">
                Delete your ArchTruth account and remove yourself from all workspaces.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setAccountDeleteOpen(true)}>
              Delete...
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Workspace Modal */}
      <Modal open={deleteModalOpen} onOpenChange={setDeleteModalOpen} title="Delete Workspace">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete <span className="font-semibold text-foreground">{orgName}</span>, including all {repoCount} connected repositories, generated documentation, wiki pages, and embeddings. This cannot be undone.
          </p>
          <div>
            <label className="text-sm font-medium">
              Type <span className="font-mono text-destructive">{orgName}</span> to confirm
            </label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={orgName}
              className="mt-1.5"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModalOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteConfirm !== orgName || deleting}
              onClick={handleDeleteWorkspace}
              className="gap-1.5"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete Workspace
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Account Modal */}
      <Modal open={accountDeleteOpen} onOpenChange={setAccountDeleteOpen} title="Delete Account">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will permanently delete your ArchTruth account and remove you from all workspaces. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAccountDeleteOpen(false)}>Cancel</Button>
            {onDeleteAccount && (
              <form action={onDeleteAccount}>
                <Button variant="destructive" type="submit" className="gap-1.5">
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </Button>
              </form>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
