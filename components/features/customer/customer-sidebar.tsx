"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  MapPin,
  Package,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";

import { signOut } from "@/app/actions";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { cn } from "@/lib/utils";

const items = [
  { href: "/products", label: "Shop", icon: Store },
  { href: "/profile/orders", label: "My orders", icon: Package },
  { href: "/cart", label: "My cart", icon: ShoppingCart },
  { href: "/profile/addresses", label: "Addresses", icon: MapPin },
  { href: "/profile/notifications", label: "Notifications", icon: Bell },
  { href: "/profile/settings", label: "Account settings", icon: Settings },
];

export function CustomerSidebar() {
  const pathname = usePathname();
  const activeItem = items.find((item) => item.href === pathname);
  const ActiveIcon = activeItem?.icon;

  return (
    <aside className="min-w-0">
      <details className="group rounded-md border border-outline-variant/60 bg-surface-card lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold text-primary">
          <span className="flex items-center gap-2">
            {ActiveIcon ? <ActiveIcon aria-hidden="true" className="size-5" /> : null}
            {activeItem?.label ?? "Customer navigation"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="size-5 transition-transform group-open:rotate-180"
          />
        </summary>
        <CustomerSidebarNavList
          pathname={pathname}
          className="border-t border-outline-variant/60 p-2"
        />
      </details>
      <nav aria-label="Customer" className="hidden lg:block">
        <CustomerSidebarNavList
          pathname={pathname}
          className="flex min-h-[calc(100vh-11rem)] flex-col gap-1"
        />
      </nav>
    </aside>
  );
}

export function CustomerSidebarNavList({
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
      <li className="mt-8">
        <SignOutButton
          action={signOut}
          className="w-full rounded-md px-4 py-3 text-left text-sm text-error hover:bg-error-container hover:text-error hover:no-underline"
        />
      </li>
    </ul>
  );
}
