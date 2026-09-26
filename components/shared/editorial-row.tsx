import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Text beside a visual, side by side from `md` up and stacked (visual first)
 * below it. Alternate `mediaSide` down a page for a zigzag rather than a
 * plain vertical stack.
 */
export function EditorialRow({
  media,
  text,
  mediaSide,
  className,
}: {
  media: ReactNode;
  text: ReactNode;
  mediaSide: "left" | "right";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-10 md:grid-cols-12 md:gap-14",
        className,
      )}
    >
      <div
        className={cn(
          "min-w-0 md:col-span-7",
          mediaSide === "right" && "md:order-2",
        )}
      >
        {media}
      </div>
      <div
        className={cn(
          "min-w-0 md:col-span-5",
          mediaSide === "right" && "md:order-1",
        )}
      >
        {text}
      </div>
    </div>
  );
}
