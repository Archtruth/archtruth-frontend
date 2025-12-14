import * as React from "react";
import { cn } from "@/lib/utils";

export function Avatar({ src, name, className }: { src?: string | null; name?: string | null; className?: string }) {
  const fallback = name?.[0]?.toUpperCase() || "U";
  if (src) {
    return (
      <img
        src={src}
        alt={name || "User avatar"}
        className={cn("h-9 w-9 rounded-full object-cover", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary",
        className
      )}
    >
      {fallback}
    </div>
  );
}
