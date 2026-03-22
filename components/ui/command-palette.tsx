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
import { Book, Home, Layers, Network, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId?: string | null;
};

function buildHref(base: string, orgId?: string | null): string {
  if (!orgId) return base;
  const needsOrg = [
    "/dashboard",
    "/dashboard/repos",
    "/dashboard/wiki",
    "/dashboard/architecture",
    "/dashboard/settings",
    "/dashboard/connect-github",
  ];
  if (needsOrg.includes(base)) {
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
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
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

  const itemClass = "flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm aria-selected:bg-accent";

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px]"
      contentClassName={cn(
        "fixed left-1/2 top-[min(18%,8rem)] z-[101] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2",
        "overflow-hidden rounded-xl border bg-card p-0 shadow-2xl"
      )}
    >
      <CommandInput
        placeholder="Jump to a page or run an action…"
        className="flex h-12 w-full border-b bg-transparent px-4 text-sm outline-none placeholder:text-muted-foreground focus:ring-0"
      />
      <CommandList className="max-h-[min(320px,50vh)] overflow-y-auto overscroll-contain p-2">
        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">No matches.</CommandEmpty>

        <CommandGroup heading="Pages" className="px-1 pb-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandItem value="dashboard overview" keywords={["dashboard", "overview", "home"]} onSelect={() => go("/dashboard")} className={itemClass}>
            <Home className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Dashboard</span>
          </CommandItem>
          <CommandItem value="repositories repos" keywords={["repos", "repositories"]} onSelect={() => go(buildHref("/dashboard/repos", orgId))} className={itemClass}>
            <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Repositories</span>
          </CommandItem>
          <CommandItem value="wiki documentation" keywords={["wiki", "docs"]} onSelect={() => go(buildHref("/dashboard/wiki", orgId))} className={itemClass}>
            <Book className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Wiki</span>
          </CommandItem>
          <CommandItem value="architecture graph map" keywords={["architecture", "graph", "map", "capabilities"]} onSelect={() => go(buildHref("/dashboard/architecture", orgId))} className={itemClass}>
            <Network className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Architecture</span>
          </CommandItem>
          <CommandItem
            value="settings workspace"
            keywords={["settings", "workspace", "account"]}
            onSelect={() => go(buildHref("/dashboard/settings", orgId))}
            className={itemClass}
          >
            <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Settings</span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup heading="Quick actions" className="px-1 pt-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted-foreground">
          <CommandItem value="connect github install" keywords={["github", "connect", "install"]} onSelect={() => go(buildHref("/dashboard/connect-github", orgId))} className={itemClass}>
            <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="font-medium">Connect GitHub</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      <div className="flex items-center justify-between border-t bg-muted/50 px-3 py-2 text-[11px] text-muted-foreground">
        <span><kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium shadow-sm">↑↓</kbd> navigate</span>
        <span><kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium shadow-sm">↵</kbd> open</span>
        <span><kbd className="rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-medium shadow-sm">esc</kbd> close</span>
      </div>
    </CommandDialog>
  );
}
