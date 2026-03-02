"use client";

import { useEffect, useState, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type MermaidPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  svgContent: string;
  caption?: string;
};

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];
const DEFAULT_ZOOM_INDEX = 2; // 1x

export function MermaidPreviewModal({
  open,
  onOpenChange,
  svgContent,
  caption,
}: MermaidPreviewModalProps) {
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
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

  // Reset zoom when modal opens
  useEffect(() => {
    if (open) setZoomIndex(DEFAULT_ZOOM_INDEX);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Backdrop - click to close */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Content - pointer-events-none so backdrop receives clicks in empty area */}
      <div className="relative z-10 flex flex-1 flex-col min-h-0 pointer-events-none">
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/50 pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80">Diagram preview</span>
            {caption && (
              <span className="text-sm text-white/60 truncate max-w-[200px]">
                {caption}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white disabled:opacity-50"
                aria-label="Zoom out"
                onClick={zoomOut}
                disabled={zoomIndex <= 0}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-xs text-white/80 min-w-[3.5rem] text-center tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white disabled:opacity-50"
                aria-label="Zoom in"
                onClick={zoomIn}
                disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20 hover:text-white"
                aria-label="Reset zoom"
                onClick={resetZoom}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-white hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Scrollable diagram area - padding allows backdrop clicks to close */}
        <div className="flex-1 overflow-auto p-6 flex items-center justify-center min-h-0">
          <div
            className="origin-center transition-transform duration-150 ease-out [&_svg]:max-w-full [&_svg]:h-auto pointer-events-auto"
            style={{ transform: `scale(${zoom})` }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: svgContent }}
              className="mermaid-preview-content"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
