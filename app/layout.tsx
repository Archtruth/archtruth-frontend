import "./globals.css";
import type { ReactNode } from "react";
import { Providers } from "@/lib/api/query-client";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

export const metadata = {
  title: "ArchTruth",
  description: "Architecture documentation for engineering teams",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers>
            {children}
            <Toaster position="bottom-right" richColors closeButton />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
