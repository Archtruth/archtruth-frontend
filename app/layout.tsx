import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ArchTruth",
  description: "Phase 2 frontend shell",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

