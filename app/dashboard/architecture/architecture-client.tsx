"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getLayoutedElements } from "@/components/architecture/graph-layout";
import {
  Link2,
  Map,
  TreePine,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
  Plus,
  Trash2,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { backendFetch } from "@/lib/api/backend-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Capability = {
  id: string;
  name: string;
  description?: string;
  level: number;
  parent_capability_id?: string;
  children: any[];
  services: { repository_id: number; nav_order: number }[];
};

type Repo = {
  id: number;
  full_name: string;
  default_branch?: string;
  latest_job?: any;
};

type Props = {
  orgId: string;
  capabilities: Capability[];
  repositories: Repo[];
  token: string;
};

const tabs = [
  { id: "graph", label: "Service Graph", icon: Link2 },
  { id: "map", label: "Capability Map", icon: Map },
  { id: "tree", label: "Tree Editor", icon: TreePine },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function ArchitectureClient({ orgId, capabilities: initialCaps, repositories, token }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>("graph");
  const [capabilities, setCapabilities] = useState(initialCaps);

  const refreshCaps = useCallback(async () => {
    try {
      const resp = await backendFetch<{ capabilities: Capability[] }>(`/orgs/${orgId}/capabilities`, token);
      setCapabilities(resp.capabilities || []);
    } catch {}
  }, [orgId, token]);

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <h1 className="text-3xl font-semibold">Architecture</h1>

      <div className="flex items-center gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
              activeTab === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "graph" && <ServiceGraph capabilities={capabilities} repositories={repositories} />}
      {activeTab === "map" && <CapabilityMap capabilities={capabilities} repositories={repositories} />}
      {activeTab === "tree" && (
        <TreeEditor
          orgId={orgId}
          capabilities={capabilities}
          repositories={repositories}
          token={token}
          onRefresh={refreshCaps}
        />
      )}
    </div>
  );
}

function ServiceGraph({ capabilities, repositories }: { capabilities: Capability[]; repositories: Repo[] }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    capabilities.forEach((cap) => {
      nodes.push({
        id: `cap-${cap.id}`,
        data: { label: cap.name },
        position: { x: 0, y: 0 },
        type: "default",
        style: {
          background: "hsl(234 89% 63% / 0.1)",
          border: "1px solid hsl(234 89% 63% / 0.5)",
          borderRadius: 12,
          padding: 16,
          fontSize: 14,
          fontWeight: 600,
        },
        width: 180,
        height: 50,
      });

      cap.services?.forEach((svc) => {
        const repo = repositories.find((r) => r.id === svc.repository_id);
        if (!repo) return;
        const name = repo.full_name?.split("/").pop() || repo.full_name;
        nodes.push({
          id: `repo-${repo.id}`,
          data: { label: name },
          position: { x: 0, y: 0 },
          style: {
            background: "hsl(160 60% 45% / 0.1)",
            border: "1px solid hsl(160 60% 45% / 0.5)",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
          },
          width: 160,
          height: 40,
        });
        edges.push({
          id: `e-${cap.id}-${repo.id}`,
          source: `cap-${cap.id}`,
          target: `repo-${repo.id}`,
          animated: true,
          style: { stroke: "hsl(234 89% 63% / 0.3)" },
        });
      });
    });

    if (nodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(nodes, edges, "TB");
  }, [capabilities, repositories]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>Connect repositories to see your architecture graph</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-14rem)] rounded-xl border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function CapabilityMap({ capabilities, repositories }: { capabilities: Capability[]; repositories: Repo[] }) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const colors: Record<number, string> = {
      0: "hsl(234 89% 63% / 0.1)",
      1: "hsl(210 80% 55% / 0.1)",
      2: "hsl(180 60% 45% / 0.1)",
      3: "hsl(215 16% 47% / 0.1)",
    };
    const borderColors: Record<number, string> = {
      0: "hsl(234 89% 63% / 0.5)",
      1: "hsl(210 80% 55% / 0.5)",
      2: "hsl(180 60% 45% / 0.5)",
      3: "hsl(215 16% 47% / 0.5)",
    };

    capabilities.forEach((cap) => {
      nodes.push({
        id: cap.id,
        data: { label: `${cap.name} (L${cap.level})` },
        position: { x: 0, y: 0 },
        style: {
          background: colors[cap.level] || colors[0],
          border: `1px solid ${borderColors[cap.level] || borderColors[0]}`,
          borderRadius: 12,
          padding: 14,
          fontSize: cap.level === 0 ? 14 : 12,
          fontWeight: cap.level <= 1 ? 600 : 400,
        },
        width: cap.level === 0 ? 200 : 160,
        height: 50,
      });

      if (cap.parent_capability_id) {
        edges.push({
          id: `e-${cap.parent_capability_id}-${cap.id}`,
          source: cap.parent_capability_id,
          target: cap.id,
          style: { stroke: "hsl(215 16% 47% / 0.3)" },
          type: "smoothstep",
        });
      }

      cap.services?.forEach((svc) => {
        const repo = repositories.find((r) => r.id === svc.repository_id);
        if (!repo) return;
        const name = repo.full_name?.split("/").pop() || repo.full_name;
        const nodeId = `svc-${cap.id}-${repo.id}`;
        if (!nodes.find((n) => n.id === nodeId)) {
          nodes.push({
            id: nodeId,
            data: { label: name },
            position: { x: 0, y: 0 },
            style: {
              background: "hsl(160 60% 45% / 0.1)",
              border: "1px solid hsl(160 60% 45% / 0.5)",
              borderRadius: 8,
              padding: 10,
              fontSize: 11,
            },
            width: 140,
            height: 36,
          });
          edges.push({
            id: `e-${cap.id}-svc-${repo.id}`,
            source: cap.id,
            target: nodeId,
            style: { stroke: "hsl(160 60% 45% / 0.3)" },
          });
        }
      });
    });

    if (nodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(nodes, edges, "TB");
  }, [capabilities, repositories]);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <p>Create capabilities in the Tree Editor tab to see the hierarchy map</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-14rem)] rounded-xl border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

function TreeEditor({
  orgId,
  capabilities,
  repositories,
  token,
  onRefresh,
}: {
  orgId: string;
  capabilities: Capability[];
  repositories: Repo[];
  token: string;
  onRefresh: () => Promise<void>;
}) {
  const [selectedCap, setSelectedCap] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newCapName, setNewCapName] = useState("");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const rootCaps = capabilities.filter((c) => !c.parent_capability_id);
  const selected = capabilities.find((c) => c.id === selectedCap);
  const getRepoName = (id: number) => {
    const r = repositories.find((r) => r.id === id);
    return r?.full_name?.split("/").pop() || `Repo #${id}`;
  };

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  async function handleCreateCap(parentId?: string) {
    if (!newCapName.trim()) return;
    setCreating(true);
    try {
      await backendFetch(`/orgs/${orgId}/capabilities`, token, {
        method: "POST",
        body: JSON.stringify({
          name: newCapName.trim(),
          ...(parentId ? { parent_capability_id: parentId } : {}),
        }),
      });
      setNewCapName("");
      await onRefresh();
      toast.success("Capability created");
    } catch (e: any) {
      toast.error(e.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteCap(capId: string) {
    setLoading(true);
    try {
      await backendFetch(`/orgs/${orgId}/capabilities/${capId}`, token, { method: "DELETE" });
      setSelectedCap(null);
      await onRefresh();
      toast.success("Capability deleted");
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  }

  function renderTree(caps: Capability[], depth = 0) {
    return caps.map((cap) => {
      const children = capabilities.filter((c) => c.parent_capability_id === cap.id);
      const isOpen = expanded.has(cap.id);
      return (
        <div key={cap.id}>
          <button
            onClick={() => { setSelectedCap(cap.id); toggle(cap.id); }}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-sm hover:bg-accent transition-colors",
              selectedCap === cap.id && "bg-primary/10 text-primary"
            )}
            style={{ paddingLeft: 12 + depth * 16 }}
          >
            {children.length > 0 || (cap.services?.length || 0) > 0 ? (
              isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            ) : <div className="w-3.5" />}
            {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" /> : <Folder className="h-3.5 w-3.5 text-primary shrink-0" />}
            <span className="font-medium truncate">{cap.name}</span>
            <Badge variant="secondary" className="ml-auto text-xs">L{cap.level}</Badge>
          </button>
          {isOpen && (
            <div>
              {children.length > 0 && renderTree(children, depth + 1)}
              {cap.services?.map((svc) => (
                <div
                  key={svc.repository_id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground"
                  style={{ paddingLeft: 28 + (depth + 1) * 16 }}
                >
                  <span className="truncate">{getRepoName(svc.repository_id)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[calc(100vh-16rem)]">
      {/* Tree */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="New capability name..."
              value={newCapName}
              onChange={(e) => setNewCapName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateCap()}
              className="flex-1 h-9"
            />
            <Button size="sm" onClick={() => handleCreateCap()} disabled={creating || !newCapName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="space-y-0.5">
            {rootCaps.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No capabilities yet. Create your first one above.</p>
            )}
            {renderTree(rootCaps)}
          </div>
        </CardContent>
      </Card>

      {/* Detail Panel */}
      <Card>
        <CardContent className="p-4">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-16">
              <TreePine className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">Select a capability to view details</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-semibold">{selected.name}</h3>
                <Badge variant="secondary" className="mt-1">Level {selected.level}</Badge>
              </div>
              {selected.description && (
                <p className="text-sm text-muted-foreground">{selected.description}</p>
              )}
              <div>
                <h4 className="text-sm font-medium mb-2">Assigned Services ({selected.services?.length || 0})</h4>
                {(selected.services?.length || 0) === 0 ? (
                  <p className="text-sm text-muted-foreground">No services assigned</p>
                ) : (
                  <div className="space-y-1">
                    {selected.services?.map((svc) => (
                      <div key={svc.repository_id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                        <span>{getRepoName(svc.repository_id)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selected.level < 3 && (
                <div className="pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Add sub-capability..."
                      value={newCapName}
                      onChange={(e) => setNewCapName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateCap(selected.id)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button size="sm" variant="outline" onClick={() => handleCreateCap(selected.id)} disabled={creating || !newCapName.trim()}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteCap(selected.id)}
                  disabled={loading || (selected.services?.length || 0) > 0}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete Capability
                </Button>
                {(selected.services?.length || 0) > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Reassign services before deleting</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
