"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import {
  LogOut,
  Book,
  Layers,
  Home,
  User,
  Network,
  Search,
  Settings,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
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
  const searchParams = useSearchParams();
  const [orgId, setOrgId] = useState<string | undefined>(currentOrgId || orgOptions?.[0]?.id);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("Ctrl+K");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  useEffect(() => {
    const urlOrgId = searchParams.get("org_id");
    if (urlOrgId) {
      setOrgId(urlOrgId);
      return;
    }
    if (currentOrgId) setOrgId(currentOrgId);
    else if (orgOptions?.[0]?.id) setOrgId(orgOptions[0].id);
  }, [searchParams, pathname, currentOrgId, orgOptions]);

  const navItems: NavItem[] = useMemo(() => {
    const oid = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";
    return [
      { label: "Overview", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
      { label: "Repositories", href: `/dashboard/repos${oid}`, icon: <Layers className="h-4 w-4" /> },
      { label: "Wiki", href: `/dashboard/wiki${oid}`, icon: <Book className="h-4 w-4" /> },
      { label: "Architecture", href: `/dashboard/architecture${oid}`, icon: <Network className="h-4 w-4" /> },
    ];
  }, [orgId]);

  const settingsItem: NavItem = useMemo(() => ({
    label: "Settings",
    href: "/dashboard/settings",
    icon: <Settings className="h-4 w-4" />,
  }), []);

  const isActive = (href: string) => {
    if (!pathname) return false;
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(base);
  };

  const currentOrg = orgOptions?.find((o) => o.id === orgId);

  const handleOrgSwitch = (id: string) => {
    setOrgId(id);
    setOrgDropdownOpen(false);
    if (pathname && pathname !== "/dashboard" && pathname !== "/dashboard/settings") {
      const base = pathname.split("?")[0];
      router.push(`${base}?org_id=${encodeURIComponent(id)}`);
    }
    router.refresh();
  };

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setShortcutHint(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarContent = (
    <>
      <div className="px-4 pt-5 pb-3">
        <Link href="/dashboard" className="flex items-center gap-2 text-sidebar-foreground">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Book className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ArchTruth</span>
        </Link>
      </div>

      {orgOptions && orgOptions.length > 0 && (
        <div className="px-3 pb-4">
          <div className="relative">
            <button
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-white/10 transition-colors"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20 text-primary text-xs font-bold">
                {currentOrg?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="flex-1 truncate text-left font-medium">{currentOrg?.name || "Select workspace"}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", orgDropdownOpen && "rotate-180")} />
            </button>
            {orgDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-white/10 bg-sidebar p-1 shadow-xl">
                {orgOptions.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleOrgSwitch(org.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground hover:bg-white/10 transition-colors",
                      org.id === orgId && "bg-white/10"
                    )}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold bg-primary/20 text-primary">
                      {org.name[0]?.toUpperCase()}
                    </div>
                    {org.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => (
          <Link key={item.label} href={item.href} className="block">
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                isActive(item.href)
                  ? "bg-white/15 text-white border-l-2 border-primary"
                  : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
              )}
            >
              {item.icon}
              {item.label}
            </div>
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <Link href={settingsItem.href} className="block">
          <div
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
              isActive(settingsItem.href)
                ? "bg-white/15 text-white border-l-2 border-primary"
                : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground"
            )}
          >
            {settingsItem.icon}
            {settingsItem.label}
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 bg-sidebar">
        {sidebarContent}
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex justify-end p-2">
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} className="text-sidebar-foreground hover:bg-white/10">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden sm:flex flex-1 max-w-lg">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start gap-2 pl-3 pr-2 text-left font-normal text-muted-foreground shadow-sm"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-sm">Search or jump to…</span>
              <kbd className="hidden sm:inline-flex h-5 shrink-0 items-center rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {shortcutHint}
              </kbd>
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <ThemeToggle />
            <span className="hidden sm:inline text-sm font-medium">{userName || "User"}</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={userAvatar || ""} alt={userName || "User"} />
              <AvatarFallback className="text-xs">{userName ? userName[0]?.toUpperCase() : <User className="h-3.5 w-3.5" />}</AvatarFallback>
            </Avatar>
            {onLogout && (
              <form action={onLogout}>
                <Button variant="ghost" size="sm" type="submit" className="gap-1.5 text-muted-foreground hover:text-foreground">
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </form>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} orgId={orgId} />
    </div>
  );
}
