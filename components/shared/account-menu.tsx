"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { accountMenuItems } from "@/components/shared/account-menu-items";

/** The signed-in Customer's avatar and first name; opens a menu to their account pages. Closes on Escape, a click away or choosing a link. */
export function AccountMenu({ initials, firstName, signOut }: { initials: string; firstName: string; signOut: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      } else if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2.5 hover:text-primary"
      >
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white"
        >
          {initials}
        </span>
        <span className="tracking-[0.35px]">{firstName}</span>
        <ChevronDown aria-hidden size={14} className={open ? "rotate-180 transition" : "transition"} />
      </button>
      {/* Stays mounted while closed so the sign-out confirmation survives the menu hiding behind it. */}
      <div className={open ? "absolute right-0 top-full z-10 pt-3" : "hidden"}>
          <ul className="min-w-56 overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface py-2 text-on-surface shadow-lg">
            {accountMenuItems.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low hover:text-primary"
                >
                  <Icon aria-hidden className="size-[18px]" strokeWidth={1.5} />
                  {label}
                </Link>
              </li>
            ))}
            <li className="mt-1 border-t border-outline-variant/60 pt-1">{signOut}</li>
          </ul>
        </div>
    </div>
  );
}

/** The signed-in Customer's avatar and first name in the mobile menu; expands in place to their account pages and sign out. */
export function MobileAccountMenu({ initials, firstName, signOut }: { initials: string; firstName: string; signOut: ReactNode }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2.5 py-1 text-sm font-semibold text-on-surface hover:text-primary"
      >
        <span aria-hidden className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-medium tracking-[0.35px] text-white">
          {initials}
        </span>
        {firstName}
        <ChevronDown aria-hidden size={16} className={expanded ? "ml-auto rotate-180 transition" : "ml-auto transition"} />
      </button>
      {/* Stays mounted while collapsed so the sign-out confirmation survives the list hiding behind it. */}
      <ul className={expanded ? "mt-2 flex flex-col" : "hidden"}>
        {accountMenuItems.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 py-2.5 pl-4 text-sm font-semibold text-on-surface-variant hover:text-primary">
              <Icon aria-hidden className="size-[18px]" strokeWidth={1.5} />
              {label}
            </Link>
          </li>
        ))}
        <li className="pl-4">{signOut}</li>
      </ul>
    </div>
  );
}
