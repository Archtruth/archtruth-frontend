"use client";

import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";

type Heading = {
  level: number;
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

  // Extract markdown content between <MARKDOWN> tags if present
  let content = markdown;
  const mdStart = markdown.indexOf("<MARKDOWN>");
  const mdEnd = markdown.indexOf("</MARKDOWN>");
  if (mdStart >= 0 && mdEnd > mdStart) {
    content = markdown.substring(mdStart + 10, mdEnd);
  }

  const headings: Heading[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^(#{2,4})\s+(.+)$/);
    if (match) {
      const level = match[1].length; // 2, 3, or 4
      const title = match[2].trim();
      const id = generateAnchorId(title);
      headings.push({ level, title, id });
    }
  }

  return headings;
}

export function TableOfContents({ markdown }: { markdown: string }) {
  const [activeId, setActiveId] = useState<string>("");
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);

  useEffect(() => {
    if (headings.length === 0) return;

    // Set up intersection observer for active section highlighting
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the heading that's most visible
        let mostVisible: IntersectionObserverEntry | null = null;
        let maxRatio = 0;

        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            mostVisible = entry;
          }
        }

        if (mostVisible && mostVisible.intersectionRatio > 0.3) {
          setActiveId(mostVisible.target.id);
        }
      },
      {
        rootMargin: "-20% 0% -35% 0%",
        threshold: [0, 0.3, 0.5, 0.7, 1],
      }
    );

    // Wait a bit for DOM to be ready, then observe headings
    const timeoutId = setTimeout(() => {
      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);
        if (element) {
          observer.observe(element);
        }
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [headings]);

  const handleClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // Account for fixed header
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
      setActiveId(id);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-24 space-y-2">
      <h2 className="text-sm font-semibold text-foreground mb-3">On this page</h2>
      <nav className="space-y-1">
        {headings.map((heading, index) => {
          const isActive = activeId === heading.id;
          const indent = heading.level === 3 ? "ml-4" : heading.level === 4 ? "ml-8" : "";
          
          return (
            <a
              key={index}
              href={`#${heading.id}`}
              onClick={(e) => handleClick(heading.id, e)}
              className={cn(
                "block text-sm transition-colors hover:text-foreground",
                indent,
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              {heading.title}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

