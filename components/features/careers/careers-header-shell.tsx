"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Header layout: the brand stays visible; below `lg` the nav and account links collapse behind a toggle icon. */
export function CareersHeaderShell({
  className,
  brand,
  children,
}: {
  className: string;
  brand: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronUp : ChevronDown;

  return (
    <div className={className}>
      {brand}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="careers-header-menu"
        aria-label={open ? "Collapse header menu" : "Expand header menu"}
        onClick={() => setOpen(!open)}
        className="ml-auto grid size-10 place-items-center rounded-full text-primary transition hover:bg-lavender-soft lg:hidden"
      >
        <Icon aria-hidden className="size-6" />
      </button>
      <div
        id="careers-header-menu"
        className={cn(
          "w-full flex-col items-stretch gap-3 lg:contents",
          open ? "flex" : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
