"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type Heading = {
  title: string;
  id: string;
};

function generateAnchorId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

function extractHeadings(markdown: string): Heading[] {
  if (!markdown) return [];

  let content = markdown;
  const mdStart = markdown.indexOf("<MARKDOWN>");
  const mdEnd = markdown.indexOf("</MARKDOWN>");
  if (mdStart >= 0 && mdEnd > mdStart) {
    content = markdown.substring(mdStart + 10, mdEnd);
  }

  const headings: Heading[] = [];
  for (const line of content.split("\n")) {
    const match = line.match(/^##\s+(.+)$/);
    if (match) {
      const title = match[1].trim();
      headings.push({ title, id: generateAnchorId(title) });
    }
  }
  return headings;
}

export function TableOfContents({ markdown }: { markdown: string }) {
  const [activeId, setActiveId] = useState<string>("");
  const mainRef = useRef<HTMLElement | null>(null);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);

  useEffect(() => {
    mainRef.current = document.querySelector("main");
  }, []);

  useEffect(() => {
    if (headings.length === 0) return;

    const scrollRoot = mainRef.current ?? document;
    const root = scrollRoot === document ? null : scrollRoot;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > 0) {
            const ratio = entry.intersectionRatio;
            if (!best || ratio > best.ratio) {
              best = { id: entry.target.id, ratio };
            }
          }
        }
        if (best && best.ratio >= 0.2) {
          setActiveId(best.id);
        }
      },
      {
        root,
        rootMargin: "-80px 0% -60% 0%",
        threshold: [0, 0.2, 0.4, 0.6, 0.8, 1],
      }
    );

    const timeoutId = setTimeout(() => {
      headings.forEach((h) => {
        const el = document.getElementById(h.id);
        if (el) observer.observe(el);
      });
    }, 150);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [headings]);

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  };

  if (headings.length === 0) return null;

  return (
    <div className="sticky top-24 space-y-2">
      <h2 className="text-sm font-semibold text-foreground mb-3">On this page</h2>
      <nav className="space-y-1">
        {headings.map((heading, i) => (
          <a
            key={i}
            href={`#${heading.id}`}
            onClick={(e) => handleClick(heading.id, e)}
            className={cn(
              "block py-1 text-sm transition-colors border-l-2 -ml-px pl-0",
              activeId === heading.id
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            {heading.title}
          </a>
        ))}
      </nav>
    </div>
  );
}

