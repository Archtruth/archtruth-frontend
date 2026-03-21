"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "cmdk";
import {
  Book,
  Building2,
  Home,
  Layers,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, repo/wiki/chat links include the same org scoping as the sidebar. */
  orgId?: string | null;
};

function buildHref(base: string, orgId?: string | null): string {
  if (!orgId) return base;
  if (base === "/dashboard/repos" || base === "/dashboard/chat") {
    return `${base}?org_id=${encodeURIComponent(orgId)}`;
  }
  if (base === "/wiki") {
    return `${base}?org_id=${encodeURIComponent(orgId)}`;
  }
  if (base === "/dashboard/connect-github") {
    return `${base}?org_id=${encodeURIComponent(orgId)}`;
  }
  return base;
}

export function CommandPalette({ open, onOpenChange, orgId }: CommandPaletteProps) {
  const router = useRouter();

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      onOpenChange(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange]);

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-[2px]"
      contentClassName={cn(
        "fixed left-1/2 top-[min(18%,8rem)] z-[101] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2",
        "overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl shadow-slate-900/10"
      )}
    >
      <CommandInput
        placeholder="Jump to a page or run an action…"
        className={cn(
          "flex h-12 w-full border-b border-slate-200 bg-transparent px-4 text-sm outline-none",
          "placeholder:text-slate-400 focus:ring-0"
        )}
      />
      <CommandList className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain p-2">
        <CommandEmpty className="py-6 text-center text-sm text-slate-500">No matches.</CommandEmpty>

        <CommandGroup
          heading="Pages"
          className="px-1 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-400"
        >
          <CommandItem
            value="dashboard overview home"
            keywords={["dashboard", "overview", "home"]}
            onSelect={() => go("/dashboard")}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Home className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Dashboard</span>
          </CommandItem>
          <CommandItem
            value="repositories repos"
            keywords={["repos", "repositories", "github"]}
            onSelect={() => go(buildHref("/dashboard/repos", orgId))}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Layers className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Repos</span>
          </CommandItem>
          <CommandItem
            value="wiki documentation"
            keywords={["wiki", "docs", "documentation"]}
            onSelect={() => go(buildHref("/wiki", orgId))}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Book className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Wiki</span>
          </CommandItem>
          <CommandItem
            value="chat messages"
            keywords={["chat", "messages", "assistant"]}
            onSelect={() => go(buildHref("/dashboard/chat", orgId))}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Chat</span>
          </CommandItem>
          <CommandItem
            value="settings workspace account"
            keywords={["settings", "account", "preferences", "workspace"]}
            onSelect={() => go("/dashboard")}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Settings className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Settings</span>
            <span className="ml-auto text-xs text-slate-400">Workspace</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup
          heading="Quick actions"
          className="px-1 pt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-slate-400"
        >
          <CommandItem
            value="create organization org workspace"
            keywords={["create", "organization", "org", "new workspace"]}
            onSelect={() => go("/dashboard")}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Building2 className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Create org</span>
          </CommandItem>
          <CommandItem
            value="connect github install"
            keywords={["github", "connect", "install", "app"]}
            onSelect={() => go(buildHref("/dashboard/connect-github", orgId))}
            className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900"
          >
            <Plus className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="font-medium">Connect GitHub</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 shadow-sm">
            ↑↓
          </kbd>{" "}
          navigate
        </span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 shadow-sm">
            ↵
          </kbd>{" "}
          open
        </span>
        <span>
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-600 shadow-sm">
            esc
          </kbd>{" "}
          close
        </span>
      </div>
    </CommandDialog>
  );
}
