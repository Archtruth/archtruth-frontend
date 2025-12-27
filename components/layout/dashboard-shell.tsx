"use client";

"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Book,
  Layers,
  Home,
  Plus,
  Trash2,
  MessageSquare,
  User,
  Library,
  Network,
  Search,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

type OrgOption = { id: string; name: string };

type DashboardShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userAvatar?: string | null;
  onLogout?: () => Promise<void> | void;
  onDeleteAccount?: () => Promise<void> | void;
  orgOptions?: OrgOption[];
  currentOrgId?: string | null;
};

const baseNavItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
  { label: "Connect GitHub", href: "/dashboard/connect-github", icon: <Plus className="h-4 w-4" /> },
  { label: "Repositories", href: "/dashboard/repos", icon: <Layers className="h-4 w-4" /> },
  { label: "Org Docs", href: "/dashboard/orgs/docs", icon: <Library className="h-4 w-4" /> },
  { label: "Architecture", href: "/dashboard/orgs/architecture", icon: <Network className="h-4 w-4" /> },
  { label: "Chat", href: "/dashboard/chat", icon: <MessageSquare className="h-4 w-4" /> },
];

export function DashboardShell({
  children,
  userName,
  userAvatar,
  onLogout,
  onDeleteAccount,
  orgOptions,
  currentOrgId,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [orgId, setOrgId] = useState<string | undefined>(currentOrgId || orgOptions?.[0]?.id);

  useEffect(() => {
    if (currentOrgId) setOrgId(currentOrgId);
    else if (orgOptions?.[0]?.id) setOrgId(orgOptions[0].id);
  }, [currentOrgId, orgOptions]);

  const scopedNavItems = useMemo(() => {
    if (!orgId) return baseNavItems;
    return baseNavItems.map((item) => {
      if (item.href.startsWith("/dashboard/repos") || item.href.startsWith("/dashboard/chat")) {
        return { ...item, href: `${item.href}?org_id=${encodeURIComponent(orgId)}` };
      }
      if (item.href === "/dashboard/orgs/docs") {
        return { ...item, href: `/dashboard/orgs/${orgId}/docs` };
      }
      if (item.href === "/dashboard/orgs/architecture") {
        return { ...item, href: `/dashboard/orgs/${orgId}/architecture` };
      }
      return item;
    });
  }, [orgId]);

  const activeHref = useMemo(() => {
    if (!pathname) return undefined;
    
    // Extract base path from href (remove query params)
    const getBasePath = (href: string) => href.split('?')[0];
    
    // For each nav item, check if current pathname matches
    const match = scopedNavItems.find((item) => {
      const basePath = getBasePath(item.href);
      
      // Exact match for dashboard home
      if (basePath === "/dashboard") {
        return pathname === "/dashboard";
      }
      
      // Prefix match for all other routes
      return pathname.startsWith(basePath);
    });
    
    return match?.href;
  }, [pathname, scopedNavItems]);

  const handleOrgChange = (val: string) => {
    setOrgId(val);
    // Default: take user to repos list scoped to org.
    router.push(`/dashboard/repos?org_id=${encodeURIComponent(val)}`);
    // Force a refresh to ensure server components re-fetch
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-slate-900">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-white">
              <Book className="h-4 w-4" />
            </div>
            <span className="text-base sm:text-lg">ArchTruth</span>
          </Link>
          <div className="hidden md:flex flex-1 items-center gap-3">
            <div className="relative flex-1 max-w-lg">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search docs, repos, endpoints (coming soon)"
                className="pl-9"
                aria-label="Global search (coming soon)"
              />
            </div>
            <Select value={orgId} onValueChange={handleOrgChange} disabled={!orgOptions || orgOptions.length === 0}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select org" />
              </SelectTrigger>
              <SelectContent>
                {(orgOptions || []).map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
                {(!orgOptions || orgOptions.length === 0) && <SelectItem value="__none" disabled>No orgs</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:flex flex-col text-right leading-tight">
              <span className="text-sm font-semibold">{userName || "User"}</span>
              <span className="text-xs text-slate-500">{orgId ? "Org scoped" : "No org selected"}</span>
            </div>
             <Avatar>
                <AvatarImage src={userAvatar || ""} alt={userName || "User"} />
              <AvatarFallback>{userName ? userName[0]?.toUpperCase() : <User className="h-4 w-4" />}</AvatarFallback>
             </Avatar>
            {onLogout ? (
              <form action={onLogout}>
                <Button variant="ghost" size="sm" type="submit" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-screen-2xl flex-1 gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="hidden md:block w-64 shrink-0">
          <nav className="space-y-1 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            {scopedNavItems.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    "[&_svg]:text-slate-500 hover:[&_svg]:text-slate-900",
                    activeHref === item.href ? "bg-slate-900 text-white hover:text-white hover:bg-slate-800" : ""
                  )}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            ))}
          {onDeleteAccount && (
              <div className="mt-4 border-t border-slate-200 pt-3">
              <form action={onDeleteAccount}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={(e) => {
                      if (
                        !confirm(
                          "Are you sure you want to delete your account? This action cannot be undone and will delete all your data."
                        )
                      ) {
                      e.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Account
                </button>
              </form>
            </div>
          )}
          </nav>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Network className="h-4 w-4" />
              Scope
            </div>
            <p className="mt-1 leading-relaxed">
              Use the org selector in the header to scope repos, docs, and chat. Defaults to all repos in an org.
            </p>
          </div>
        </aside>

        <main className="flex-1 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {children}
          </div>
        </main>
      </div>
    </div>
  );
}
