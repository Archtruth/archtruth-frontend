"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 2; // 1x

export function MermaidBlock({ code, caption }: { code: string; caption?: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);

  const id = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);
  const zoom = ZOOM_LEVELS[zoomIndex];

  const zoomIn = useCallback(() => {
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, []);

  // Match page theme: only use document class, not system preference
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();

    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    const run = async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        // Match page theme: light when page is light, dark when page is dark
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
      <div className="flex items-center justify-end gap-1 mb-2">
        <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 p-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Zoom out"
            onClick={zoomOut}
            disabled={zoomIndex <= 0}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[2.5rem] text-center tabular-nums px-1">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Reset zoom"
            onClick={resetZoom}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto overflow-y-auto max-h-[600px] rounded-lg flex items-center justify-center p-4 [&_svg]:max-w-full [&_svg]:h-auto">
        <div
          className="origin-center transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="mermaid-container"
          />
        </div>
      </div>
      {caption && (
        <p className="mt-2 text-center text-sm text-muted-foreground italic">
          {caption}
        </p>
      )}
    </div>
  );
}
