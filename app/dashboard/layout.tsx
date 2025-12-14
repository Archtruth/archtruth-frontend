import type { ReactNode } from "react";

export const metadata = {
  title: "ArchTruth Dashboard",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <main className="container">
      <div className="card">{children}</div>
    </main>
  );
}

