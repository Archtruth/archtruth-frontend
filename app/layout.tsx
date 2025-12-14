import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "ArchTruth",
  description: "Developer docs automation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

