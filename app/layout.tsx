import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/lib/api/query-client";
import { Toaster } from "sonner";

export const metadata = {
  title: "ArchTruth",
  description: "Developer docs automation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-right" richColors closeButton />
        </Providers>
      </body>
    </html>
  );
}

