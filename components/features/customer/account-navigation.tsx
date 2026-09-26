"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  CircleUserRound,
  Mail,
  MapPin,
  Package,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/profile", label: "My details", icon: CircleUserRound },
  { href: "/profile/addresses", label: "My address book", icon: MapPin },
  { href: "/profile/orders", label: "My orders", icon: Package },
  { href: "/profile/newsletter", label: "My newsletters", icon: Mail },
  { href: "/profile/settings", label: "Account settings", icon: Settings },
];

export function AccountNavigation() {
  const pathname = usePathname();
  const activeItem = items.find((item) => item.href === pathname) ?? items[0];
  return (
    <>
      <details className="group rounded-md border border-outline-variant/60 bg-surface-card lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-primary">
          <span className="flex items-center gap-2">
            <activeItem.icon aria-hidden="true" className="size-5" />
            {activeItem.label}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-5 transition-transform group-open:rotate-180"
          />
        </summary>
        <NavList
          pathname={pathname}
          className="border-t border-outline-variant/60 p-2"
        />
      </details>
      <nav aria-label="Account" className="hidden lg:block">
        <NavList pathname={pathname} className="space-y-1" />
      </nav>
    </>
  );
}

function NavList({
  className,
  pathname,
}: {
  className?: string;
  pathname: string;
}) {
  return (
    <ul className={className}>
      {items.map((item) => {
        const active = item.href === pathname;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-4 py-3 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-primary-fixed/60 hover:text-primary",
                active && "bg-primary-fixed text-primary",
              )}
              href={item.href}
            >
              <Icon aria-hidden="true" className="size-5" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
