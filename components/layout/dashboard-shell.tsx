import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogOut, Github, Layers, Home, Plus } from "lucide-react";

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
};

const navItems: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: <Home className="h-4 w-4" /> },
  { label: "Connect GitHub", href: "/dashboard/connect-github", icon: <Plus className="h-4 w-4" /> },
  { label: "Repositories", href: "/dashboard/repos", icon: <Layers className="h-4 w-4" /> },
];

export function DashboardShell({ children, userName, userAvatar, onLogout }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-10 border-b border-border bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Github className="h-5 w-5" />
            <span className="text-lg font-semibold">ArchTruth</span>
          </div>
          <div className="flex items-center gap-3">
            <Avatar src={userAvatar || undefined} name={userName || undefined} />
            <div className="text-sm">
              <div className="font-semibold leading-tight">{userName || "User"}</div>
            </div>
            {onLogout ? (
              <form action={onLogout}>
                <Button variant="outline" size="sm" type="submit" className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </form>
            ) : null}
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-[220px,1fr]">
        <aside className="hidden lg:block">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="block">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-mutedForeground hover:bg-white hover:text-foreground",
                    "[&_svg]:text-mutedForeground hover:[&_svg]:text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </div>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
