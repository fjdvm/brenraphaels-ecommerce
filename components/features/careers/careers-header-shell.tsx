"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Header layout. From `lg` the brand, `nav` and `actions` sit in one row. Below it the row keeps the brand and the
 * always-visible `actions`, and a menu button opens `drawer` (the section links and calls to action) from the right.
 */
export function CareersHeaderShell({
  className,
  brand,
  nav,
  actions,
  drawer,
}: {
  className: string;
  brand: React.ReactNode;
  nav: React.ReactNode;
  actions: React.ReactNode;
  drawer: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={className}>
      {brand}
      {nav}
      {actions}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="careers-header-menu"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="grid size-10 shrink-0 place-items-center rounded-full bg-lavender-soft text-primary transition hover:bg-lavender lg:hidden"
      >
        <Menu aria-hidden className="size-5" />
      </button>
      <div className={cn("fixed inset-0 z-50 lg:hidden", open ? "block" : "hidden")}>
        <div aria-hidden className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
        <div
          id="careers-header-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Careers menu"
          onClick={(event) => (event.target as HTMLElement).closest("a") && setOpen(false)}
          className="absolute inset-y-0 right-0 flex w-[320px] max-w-[85vw] flex-col whitespace-normal rounded-l-[28px] bg-surface"
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-lavender-soft text-primary transition hover:bg-lavender"
          >
            <X aria-hidden className="size-5" />
          </button>
          {drawer}
        </div>
      </div>
    </div>
  );
}
