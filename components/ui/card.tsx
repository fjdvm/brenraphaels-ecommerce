import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "border border-outline-variant/50 bg-surface-card",
        className,
      )}
      {...props}
    />
  );
}
