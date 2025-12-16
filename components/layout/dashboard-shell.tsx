"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Book, Layers, Home, Plus, Trash2, MessageSquare, User } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
};

type DashboardShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userAvatar?: string | null;
  onLogout?: () => Promise<void> | void;
  onDeleteAccount?: () => Promise<void> | void;
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
  { label: "Connect GitHub", href: "/dashboard/connect-github", icon: <Plus className="h-4 w-4" /> },
  { label: "Repositories", href: "/dashboard/repos", icon: <Layers className="h-4 w-4" /> },
  { label: "Chat", href: "/dashboard/chat", icon: <MessageSquare className="h-4 w-4" /> },
];

export function DashboardShell({ children, userName, userAvatar, onLogout, onDeleteAccount }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl tracking-tight text-primary">
            <Book className="h-6 w-6" />
            <span>ArchTruth</span>
          </Link>
          <div className="flex items-center gap-3">
             <Avatar>
                <AvatarImage src={userAvatar || ""} alt={userName || "User"} />
                <AvatarFallback>
                    {userName ? userName[0].toUpperCase() : <User className="h-4 w-4" />}
                </AvatarFallback>
             </Avatar>
            <div className="text-sm">
              <div className="font-semibold leading-tight">{userName || "User"}</div>
            </div>
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
      <div className="container mx-auto grid max-w-screen-2xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[220px,1fr]">
        <aside className="hidden lg:block">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-mutedForeground hover:bg-accent hover:text-foreground",
                    "[&_svg]:text-mutedForeground hover:[&_svg]:text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
          {onDeleteAccount && (
            <div className="mt-8 border-t border-border pt-4">
              <form action={onDeleteAccount}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={(e) => {
                    if (!confirm("Are you sure you want to delete your account? This action cannot be undone and will delete all your data.")) {
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
        </aside>
        <main className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
