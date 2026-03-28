"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CommandPalette } from "@/components/ui/command-palette";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { setPreferredOrganization } from "@/app/dashboard/actions/set-preferred-org";
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
  /** Default org when URL has no valid org_id (from cookie on server). */
  preferredOrgId?: string | null;
};

export function DashboardShell({
  children,
  userName,
  userAvatar,
  onLogout,
  onDeleteAccount: _onDeleteAccount,
  orgOptions,
  preferredOrgId,
}: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [shortcutHint, setShortcutHint] = useState("Ctrl+K");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [navPending, startNavTransition] = useTransition();

  // Primitive string (not orgOptions ref): parent passes a new array every RSC render.
  const orgIdsFingerprint = orgOptions?.length ? orgOptions.map((o) => o.id).sort().join("|") : "";

  const orgId = useMemo(() => {
    const raw = searchParams.get("org_id");
    if (raw && orgOptions?.some((o) => o.id === raw)) return raw;
    return preferredOrgId || orgOptions?.[0]?.id || "";
  }, [searchParams, preferredOrgId, orgIdsFingerprint]);

  const orgQuery = orgId ? `?org_id=${encodeURIComponent(orgId)}` : "";

  const navItems: NavItem[] = useMemo(
    () => [
      { label: "Overview", href: `/dashboard${orgQuery}`, icon: <Home className="h-4 w-4 shrink-0" /> },
      { label: "Repositories", href: `/dashboard/repos${orgQuery}`, icon: <Layers className="h-4 w-4 shrink-0" /> },
      { label: "Wiki", href: `/dashboard/wiki${orgQuery}`, icon: <Book className="h-4 w-4 shrink-0" /> },
      { label: "Architecture", href: `/dashboard/architecture${orgQuery}`, icon: <Network className="h-4 w-4 shrink-0" /> },
    ],
    [orgQuery]
  );

  const settingsHref = `/dashboard/settings${orgQuery}`;

  const isActive = (href: string) => {
    if (!pathname) return false;
    const base = href.split("?")[0];
    if (base === "/dashboard") return pathname === "/dashboard";
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  const currentOrg = orgOptions?.find((o) => o.id === orgId);

  const handleOrgSwitch = async (id: string) => {
    setOrgDropdownOpen(false);
    await setPreferredOrganization(id);
    const path = pathname || "/dashboard";
    const next = new URLSearchParams(searchParams.toString());
    next.set("org_id", id);
    const tail = next.toString();
    startNavTransition(() => {
      router.push(tail ? `${path}?${tail}` : path);
    });
  };

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setShortcutHint(/Mac|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K");
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Do not call setPreferredOrganization from an effect: orgOptions is a new [] each RSC render,
  // cookies().set in the server action revalidates the tree → infinite /orgs + action spam.
  // Cookie is set when the user switches workspace (handleOrgSwitch); URL carries org_id for SSR.

  useEffect(() => {
    if (!orgDropdownOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const el = document.getElementById("org-switcher-root");
      if (el && !el.contains(e.target as Node)) setOrgDropdownOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [orgDropdownOpen]);

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium outline-none transition-colors duration-150",
      "focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
      active
        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
    );

  const sidebarContent = (
    <>
      <div className="px-4 pt-5 pb-3">
        <Link
          href={`/dashboard${orgQuery}`}
          prefetch={false}
          className="flex items-center gap-2 rounded-lg text-sidebar-foreground outline-none ring-sidebar-ring transition-colors hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Book className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight">ArchTruth</span>
        </Link>
      </div>

      {orgOptions && orgOptions.length > 0 && (
        <div className="px-3 pb-4" id="org-switcher-root">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
              className="flex w-full items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-sm text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent/50 focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-sidebar-primary/30 text-xs font-bold text-sidebar-primary-foreground">
                {currentOrg?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <span className="flex-1 truncate text-left font-medium">{currentOrg?.name || "Workspace"}</span>
              <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", orgDropdownOpen && "rotate-180")} />
            </button>
            {orgDropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-sidebar-border bg-sidebar p-1 shadow-xl">
                {orgOptions.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    onClick={() => void handleOrgSwitch(org.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/70",
                      org.id === orgId && "bg-sidebar-accent text-sidebar-accent-foreground"
                    )}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold bg-sidebar-primary/30 text-sidebar-primary-foreground">
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

      <nav className="flex flex-1 flex-col gap-0.5 px-3" aria-label="Main">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            prefetch={false}
            scroll={false}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={navLinkClass(isActive(item.href))}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-sidebar-border px-3 py-3">
        <Link
          href={settingsHref}
          prefetch={false}
          scroll={false}
          aria-current={isActive(settingsHref) ? "page" : undefined}
          className={navLinkClass(isActive(settingsHref))}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0 bg-sidebar text-sidebar-foreground">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 bottom-0 flex w-64 flex-col bg-sidebar text-sidebar-foreground animate-in slide-in-from-left duration-200">
            <div className="flex justify-end p-2">
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setMobileOpen(false)}
                className="text-sidebar-foreground hover:bg-sidebar-accent/50"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-4 text-card-foreground">
          <Button variant="ghost" size="icon" type="button" className="md:hidden h-9 w-9" onClick={() => setMobileOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>

          <div className="hidden max-w-lg flex-1 sm:flex">
            <Button
              type="button"
              variant="outline"
              className="h-9 w-full justify-start gap-2 border-border bg-background pl-3 pr-2 text-left font-normal text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setCommandPaletteOpen(true)}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate text-sm">Search or jump to…</span>
              <kbd className="hidden h-5 shrink-0 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
                {shortcutHint}
              </kbd>
            </Button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm font-medium sm:inline">{userName || "User"}</span>
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

        <main
          className={cn(
            "flex-1 overflow-y-auto p-6 transition-opacity duration-150",
            navPending && "opacity-[0.92]"
          )}
        >
          {children}
        </main>
      </div>

      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} orgId={orgId || null} />
    </div>
  );
}
