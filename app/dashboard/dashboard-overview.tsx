"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  FileText,
  FolderTree,
  Clock,
  Book,
  Network,
  Settings,
  ArrowRight,
  GitBranch,
} from "lucide-react";

type Props = {
  orgId: string;
  orgName: string;
  userName: string;
  dashboardData: {
    repositories: any[];
    org_doc_count: number;
    installation_count: number;
    capability_count: number;
    has_installation: boolean;
  } | null;
  token: string;
};

function getStatusBadge(repo: any) {
  const job = repo.latest_job;
  if (!job) return <Badge variant="secondary">No scans</Badge>;
  if (job.status === "completed") return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800">Ready</Badge>;
  if (job.status === "processing" || job.status === "pending") return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 animate-pulse">Scanning</Badge>;
  if (job.status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">{job.status}</Badge>;
}

function getRelativeTime(dateStr?: string) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function DashboardOverview({ orgId, orgName, userName, dashboardData, token }: Props) {
  const repos = dashboardData?.repositories || [];
  const orgDocCount = dashboardData?.org_doc_count || 0;
  const capabilityCount = dashboardData?.capability_count || 0;
  const hasInstallation = dashboardData?.has_installation || false;
  const recentRepos = repos.slice(0, 6);
  const readyRepos = repos.filter((r: any) => r.latest_job?.status === "completed");
  const lastSync = readyRepos.length > 0
    ? getRelativeTime(readyRepos[0]?.latest_job?.updated_at)
    : "Never";

  const stats = [
    { label: "Repositories", value: repos.length, icon: Package },
    { label: "Wiki Pages", value: readyRepos.reduce((sum: number, r: any) => sum + (r.wiki_page_count || 0), 0) || "—", icon: FileText },
    { label: "Capabilities", value: capabilityCount, icon: FolderTree },
    { label: "Last Synced", value: lastSync, icon: Clock },
  ];

  const quickActions = [
    { label: "Browse Wiki", desc: "Explore documentation for all services", href: `/dashboard/wiki?org_id=${orgId}`, icon: Book },
    { label: "Architecture", desc: "View capability map and service graph", href: `/dashboard/architecture?org_id=${orgId}`, icon: Network },
    {
      label: "Settings",
      desc: "Manage workspace and GitHub connection",
      href: `/dashboard/settings?org_id=${orgId}`,
      icon: Settings,
    },
  ];

  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
          <Package className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Connect your first repository</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Link your GitHub repositories to start generating architecture documentation automatically.
        </p>
        <Link href={`/dashboard/repos?org_id=${orgId}`}>
          <Button size="lg" className="gap-2">
            Connect Repositories <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Welcome back, {userName}</h1>
          <p className="text-muted-foreground mt-1">{orgName}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="hover:shadow-md transition-shadow duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {quickActions.map((action) => (
          <Link key={action.label} href={action.href} className="block h-full" prefetch scroll={false}>
            <Card className="h-full hover:shadow-md transition-shadow duration-200 cursor-pointer group">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <action.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold group-hover:text-primary transition-colors">{action.label}</div>
                    <p className="text-sm text-muted-foreground mt-1">{action.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Repos */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Repositories</h2>
          <Link href={`/dashboard/repos?org_id=${orgId}`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recentRepos.map((repo: any) => {
            const repoName = repo.full_name?.split("/").pop() || repo.full_name;
            return (
              <Card key={repo.id} className="hover:shadow-md transition-shadow duration-200">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-bold shrink-0">
                        {repoName?.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{repoName}</div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <GitBranch className="h-3.5 w-3.5" />
                          {repo.default_branch || "main"}
                          <span>·</span>
                          <span>{getRelativeTime(repo.latest_job?.updated_at)}</span>
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(repo)}
                  </div>
                  <div className="mt-3 flex items-center justify-end">
                    {repo.latest_job?.status === "completed" ? (
                      <Link href={`/dashboard/wiki?org_id=${orgId}&repo=${repo.id}`}>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-primary">
                          View Wiki <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    ) : repo.latest_job?.status === "processing" ? (
                      <span className="text-sm text-blue-600 dark:text-blue-400 animate-pulse">Scanning...</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
