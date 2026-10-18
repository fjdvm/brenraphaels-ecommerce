"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, MapPin, MessageCircle, Package, SlidersHorizontal } from "lucide-react";

export const accountMenuItems = [
  { href: "/profile/orders", label: "Orders", icon: Package },
  { href: "/support", label: "Support", icon: MessageCircle },
  { href: "/profile/addresses", label: "Addresses", icon: MapPin },
  { href: "/profile/settings", label: "Account settings", icon: SlidersHorizontal },
];

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
