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
          theme: "default",
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
      <pre className="p-3 rounded-md bg-muted text-sm overflow-auto">
        Mermaid render error: {error}
      </pre>
    );
  }

  if (!svg) {
    return <div className="text-sm text-muted-foreground">Rendering diagram…</div>;
  }

  return <div dangerouslySetInnerHTML={{ __html: svg }} />;
}


