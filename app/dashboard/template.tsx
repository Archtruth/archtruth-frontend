"use client";

import type { ReactNode } from "react";

/** Subtle enter animation so route changes feel responsive (pairs with loading.tsx). */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-in fade-in duration-200 fill-mode-both">{children}</div>;
}
