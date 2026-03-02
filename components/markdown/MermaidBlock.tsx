"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AlertCircle, Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 2; // 1x (100%)

export function MermaidBlock({ code, caption }: { code: string; caption?: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const id = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);
  const zoom = ZOOM_LEVELS[zoomIndex];

  const zoomIn = useCallback(() => {
    setTranslate({ x: 0, y: 0 });
    setZoomIndex((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setTranslate({ x: 0, y: 0 });
    setZoomIndex((i) => Math.max(i - 1, 0));
  }, []);

  const resetZoom = useCallback(() => {
    setTranslate({ x: 0, y: 0 });
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const scaledRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ zoomIndex, translate: { x: 0, y: 0 } });
  stateRef.current = { zoomIndex, translate };

  // Trackpad pinch zoom (ctrlKey/metaKey + wheel) - zoom toward cursor using translate
  useEffect(() => {
    const container = containerRef.current;
    const scaled = scaledRef.current;
    if (!container || !scaled) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const { zoomIndex: zi, translate: t } = stateRef.current;
        const currentZoom = ZOOM_LEVELS[zi];
        const containerRect = container.getBoundingClientRect();
        // Cursor position in container's scroll coordinate space
        const cursorX = e.clientX - containerRect.left + container.scrollLeft;
        const cursorY = e.clientY - containerRect.top + container.scrollTop;
        // Point in content under cursor (content uses transform-origin 0 0)
        const contentX = (cursorX - t.x) / currentZoom;
        const contentY = (cursorY - t.y) / currentZoom;

        let newZi = zi;
        if (e.deltaY < 0) newZi = Math.min(zi + 1, ZOOM_LEVELS.length - 1);
        else if (e.deltaY > 0) newZi = Math.max(zi - 1, 0);

        const newZoom = ZOOM_LEVELS[newZi];
        // New translate so content point stays under cursor
        const newTx = cursorX - contentX * newZoom;
        const newTy = cursorY - contentY * newZoom;

        stateRef.current = { zoomIndex: newZi, translate: { x: newTx, y: newTy } };
        setZoomIndex(newZi);
        setTranslate({ x: newTx, y: newTy });
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
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
                fontSize: "24px",
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
                fontSize: "24px",
              },
            };

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          flowchart: {
            nodeSpacing: 80,
            rankSpacing: 80,
          },
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
    <div className="my-2 min-w-0 w-full">
      <div className="flex items-center justify-end gap-1 mb-1">
        <div className="flex items-center gap-0.5 rounded p-0.5">
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
      <div
        ref={containerRef}
        className="overflow-x-auto overflow-y-auto [&_svg]:max-w-full [&_svg]:h-auto"
      >
        <div
          ref={scaledRef}
          className="inline-block transition-transform duration-150 ease-out"
          style={{
            transformOrigin: "0 0",
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${zoom})`,
          }}
        >
          <div
            dangerouslySetInnerHTML={{ __html: svg }}
            className="mermaid-container"
          />
        </div>
      </div>
      {caption && (
        <p className="mt-1 text-center text-sm text-muted-foreground italic">
          {caption}
        </p>
      )}
    </div>
  );
}
