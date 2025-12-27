"use client";

import { useEffect, useMemo, useState } from "react";

export function MermaidBlock({ code }: { code: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  const id = useMemo(() => `mmd-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          // Force light mode even when the surrounding UI is in dark mode.
          // We use `base` with explicit themeVariables to avoid Mermaid auto-switching.
          theme: "base",
          themeVariables: {
            darkMode: false,
            background: "#ffffff",
            primaryColor: "#f8fafc",
            primaryTextColor: "#111827",
            lineColor: "#374151",
            secondaryColor: "#ffffff",
            tertiaryColor: "#ffffff",
            textColor: "#111827",
            fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
          },
        });

        const cleaned = (code || "").trim();
        if (!cleaned) return;

        const { svg } = await mermaid.render(id, cleaned);
        if (cancelled) return;
        setSvg(svg);
        setError("");
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || "Failed to render mermaid");
        setSvg("");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [code, id]);

  if (error) {
    return (
      <pre className="not-prose p-3 rounded-md bg-muted text-sm overflow-auto">
        Mermaid render error: {error}
      </pre>
    );
  }

  if (!svg) {
    return <div className="not-prose text-sm text-muted-foreground">Rendering diagram…</div>;
  }

  return (
    <div className="not-prose my-4 rounded-md border bg-white text-black p-2 overflow-x-auto">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}


