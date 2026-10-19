"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const ActiveFilterContext = createContext<string | null>(null);

type FilterChip = { name: string; label: string; selected?: string };

/**
 * Job Posting filters: submits through the router so the Filter button can show a pending state.
 * On mobile the filters are a row of chips; the tapped chip opens its dropdown (and the buttons) beneath it.
 */
export function FilterForm({ children, className, chips }: { children: ReactNode; className?: string; chips: FilterChip[] }) {
  const router = useRouter();
  const [active, setActive] = useState<string | null>(null);

  function applyFilters(formData: FormData) {
    const params = new URLSearchParams();
    for (const [name, value] of formData) if (typeof value === "string" && value) params.set(name, value);
    router.push(params.size > 0 ? `/careers?${params}` : "/careers");
  }

  return (
    <form action={applyFilters} className="flex flex-col gap-4">
      <div role="group" aria-label="Filters" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-10 sm:px-10 lg:hidden">
        {chips.map(({ name, label, selected }) => {
          const open = active === name;
          const Icon = open ? ChevronUp : ChevronDown;
          return (
            <button
              key={name}
              type="button"
              aria-expanded={open}
              onClick={() => setActive(open ? null : name)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm tracking-[0.35px] transition",
                open
                  ? "border-primary bg-primary text-white"
                  : selected
                    ? "border-primary text-primary"
                    : "border-line text-ink hover:bg-lavender-soft",
              )}
            >
              {selected && !open ? selected : label}
              <Icon aria-hidden className="size-4" />
            </button>
          );
        })}
      </div>
      <ActiveFilterContext.Provider value={active}>
        <div className={cn(className, active === null && "max-lg:hidden")}>{children}</div>
      </ActiveFilterContext.Provider>
    </form>
  );
}

/** One filter's field: on mobile only the field of the open chip shows; on desktop all of them do. */
export function FilterField({ name, children }: { name: string; children: ReactNode }) {
  const active = useContext(ActiveFilterContext);
  return <div className={cn("flex min-w-0 flex-1 flex-col gap-2", active !== name && "max-lg:hidden")}>{children}</div>;
}
