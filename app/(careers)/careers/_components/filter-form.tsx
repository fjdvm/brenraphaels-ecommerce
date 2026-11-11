"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Check, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Filters = { department: string; employmentType: string; location: string };
type SheetGroup = { name: keyof Filters; label: string; allLabel: string; options: string[] };

const filterChipClass = "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm tracking-[0.35px] transition";

function search(filters: Partial<Filters>) {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) params.set(name, value);
  return params.size > 0 ? `/careers?${params}` : "/careers";
}

/**
 * Job Posting filters. On desktop the filter bar submits through the router; on a phone a row of chips opens
 * the design's "Filter roles" bottom sheet, whose button shows how many roles the choices would match.
 */
export function FilterForm({ children, className, groups, selected, postings }: {
  children: ReactNode;
  className?: string;
  groups: SheetGroup[];
  selected: Partial<Filters>;
  /** Every Open Job Posting's filterable fields, so the sheet can count matches as choices change. */
  postings: Filters[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Filters>>(selected);

  function applyFilters(formData: FormData) {
    const next: Partial<Filters> = {};
    for (const [name, value] of formData) if (typeof value === "string") next[name as keyof Filters] = value;
    router.push(search(next));
  }

  const matches = postings.filter((posting) => groups.every(({ name }) => !draft[name] || posting[name] === draft[name])).length;

  return (
    <div className="flex flex-col gap-4">
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setDraft(selected);
        }}
      >
        <div role="group" aria-label="Filters" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:-mx-10 sm:px-10 lg:hidden">
          {groups.map(({ name, label }) => (
            <DialogPrimitive.Trigger
              key={name}
              className={cn(filterChipClass, selected[name] ? "border-primary bg-lavender text-primary" : "border-line text-ink hover:bg-lavender-soft", "shrink-0")}
            >
              {selected[name] || label}
              <ChevronDown aria-hidden className="size-4" />
            </DialogPrimitive.Trigger>
          ))}
        </div>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-tertiary/50" />
          <DialogPrimitive.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-[28px] bg-white focus:outline-none">
            <div className="flex items-center justify-between px-5 pb-4 pt-6">
              <DialogPrimitive.Title className="font-serif text-2xl text-primary">Filter roles</DialogPrimitive.Title>
              <DialogPrimitive.Close aria-label="Close" className="grid size-10 place-items-center rounded-full bg-lavender-soft text-primary">
                <X aria-hidden className="size-4" />
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">Choose a department, employment type and location.</DialogPrimitive.Description>
            <div className="flex flex-col gap-5 overflow-y-auto px-5 pb-5">
              {groups.map(({ name, label, allLabel, options }) => (
                <fieldset key={name} className="flex flex-col gap-3">
                  <legend className="mb-3 text-sm text-ink">{label}</legend>
                  <div className="flex flex-wrap gap-2">
                    {[{ value: "", text: allLabel }, ...options.map((option) => ({ value: option, text: option }))].map(({ value, text }) => {
                      const checked = (draft[name] ?? "") === value;
                      return (
                        <label
                          key={value || "all"}
                          className={cn(filterChipClass, "cursor-pointer", checked ? "border-primary bg-lavender text-primary" : "border-line text-ink", "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary")}
                        >
                          <input
                            type="radio"
                            name={`sheet-${name}`}
                            value={value}
                            checked={checked}
                            onChange={() => setDraft((current) => ({ ...current, [name]: value }))}
                            className="sr-only"
                          />
                          {checked && value ? <Check aria-hidden className="size-4" /> : null}
                          {text}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              ))}
            </div>
            <div className="flex gap-3 border-t border-line px-5 py-4">
              <button type="button" onClick={() => setDraft({})} className="flex-1 rounded-full border border-primary py-3.5 text-primary">
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  router.push(search(draft));
                }}
                className="flex-[1.3] rounded-full bg-primary py-3.5 text-white"
              >
                Show {matches} {matches === 1 ? "role" : "roles"}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <form action={applyFilters} className={cn("max-lg:hidden", className)}>
        {children}
      </form>
    </div>
  );
}

/** One filter's field in the desktop filter bar. */
export function FilterField({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-1 flex-col gap-2">{children}</div>;
}
