"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MermaidBlock } from "./MermaidBlock";

/**
 * Shared markdown components for consistent rendering across all doc-displaying pages.
 */
export const sharedMarkdownComponents = {
  pre: ({ node, children, ...props }: any) => {
    // Detect mermaid from AST (node) or from wrapper (code returns div with data-mermaid-block)
    const codeNode = node?.children?.[0];
    const astClass = Array.isArray(codeNode?.properties?.className)
      ? codeNode.properties.className.join(" ")
      : codeNode?.properties?.className || "";
    const firstChild = React.Children.toArray(children)[0] as React.ReactElement | undefined;
    const isMermaid =
      astClass.includes("language-mermaid") ||
      firstChild?.props?.["data-mermaid-block"] === true;

    if (isMermaid) {
      return <>{children}</>;
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
      return (
        <div data-mermaid-block>
          <MermaidBlock code={text} />
        </div>
      );
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
