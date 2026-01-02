"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2 } from "lucide-react";

export function MermaidBlock({ code, caption }: { code: string; caption?: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const id = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(
        document.documentElement.classList.contains("dark") ||
        window.matchMedia("(prefers-color-scheme: dark)").matches
      );
    };
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", checkDarkMode);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const run = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        
        // Configure theme based on dark mode
        const themeConfig = isDarkMode
          ? {
              theme: "dark" as const,
              themeVariables: {
                darkMode: true,
                background: "#1e1e1e",
                primaryColor: "#3b82f6",
                primaryTextColor: "#e5e7eb",
                primaryBorderColor: "#4b5563",
                lineColor: "#6b7280",
                secondaryColor: "#374151",
                tertiaryColor: "#4b5563",
                textColor: "#e5e7eb",
                fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
              },
            }
          : {
              theme: "default" as const,
              themeVariables: {
                darkMode: false,
                background: "#ffffff",
                primaryColor: "#3b82f6",
                primaryTextColor: "#111827",
                primaryBorderColor: "#d1d5db",
                lineColor: "#374151",
                secondaryColor: "#f3f4f6",
                tertiaryColor: "#e5e7eb",
                textColor: "#111827",
                fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
              },
            };

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          ...themeConfig,
        });

        const cleaned = (code || "").trim();
        if (!cleaned) {
          if (cancelled) return;
          setError("Empty diagram code");
          setIsLoading(false);
          return;
        }

        const { svg: renderedSvg } = await mermaid.render(id, cleaned);
        if (cancelled) return;
        
        setSvg(renderedSvg);
        setError("");
        setIsLoading(false);
      } catch (e: any) {
        if (cancelled) return;
        const errorMessage = e?.message || "Failed to render diagram";
        setError(errorMessage);
        setSvg("");
        setIsLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, id, isDarkMode]);

  if (error) {
    return (
      <div className="my-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive mb-1">Diagram Rendering Error</p>
            <pre className="text-xs text-destructive/80 bg-destructive/5 p-2 rounded overflow-x-auto">
              {error}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="my-6 flex items-center justify-center rounded-lg border bg-muted/30 p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Rendering diagram…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-6">
      <div
        className={cn(
          "overflow-x-auto rounded-lg border bg-card p-4",
          "flex items-center justify-center",
          "[&_svg]:max-w-full [&_svg]:h-auto"
        )}
      >
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          className="mermaid-container"
        />
      </div>
      {caption && (
        <p className="mt-2 text-center text-sm text-muted-foreground italic">
          {caption}
        </p>
      )}
    </div>
  );
}


