"use client";

import { cn } from "@/lib/utils";
import { MermaidBlock } from "./MermaidBlock";

/**
 * Shared markdown components for consistent rendering across all doc-displaying pages.
 * Use MermaidBlock (with click-to-preview modal and zoom) everywhere.
 */
export const sharedMarkdownComponents = {
  pre: ({ children, ...props }: any) => {
    const childClass =
      (props as any)?.children?.props?.className ||
      (Array.isArray(children) && (children as any)[0]?.props?.className) ||
      "";
    const isMermaid = childClass.includes("language-mermaid");

    if (isMermaid) {
      return <div className="not-prose my-6">{children}</div>;
    }

    return (
      <pre
        {...props}
        className={cn(
          "not-prose my-4 rounded-md border bg-muted/50 p-4 overflow-x-auto text-sm",
          (props as any)?.className
        )}
      >
        {children}
      </pre>
    );
  },
  code: ({ className, children, ...props }: any) => {
    const text = String(children ?? "").replace(/\n$/, "");
    const match = /language-(\w+)/.exec(className || "");
    if (match?.[1] === "mermaid") {
      return <MermaidBlock code={text} />;
    }
    return (
      <code
        className={cn("bg-muted/50 px-1.5 py-0.5 rounded text-sm", className)}
        {...props}
      >
        {children}
      </code>
    );
  },
};
