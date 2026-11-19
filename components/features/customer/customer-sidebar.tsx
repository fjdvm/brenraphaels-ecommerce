"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronDown,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquarePlus,
  Package,
  SlidersHorizontal,
} from "lucide-react";

import { signOut } from "@/app/actions";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { initialsOf } from "@/lib/customer/initials";
import { cn } from "@/lib/utils";

const items = [
  { href: "/profile/orders", label: "My orders", icon: Package },
  { href: "/support", label: "Support", icon: MessageCircle },
  { href: "/profile/addresses", label: "Addresses", icon: MapPin },
  { href: "/profile/notifications", label: "Notifications", icon: Bell },
  { href: "/profile/settings", label: "Account settings", icon: SlidersHorizontal },
  { href: "/profile/feedback", label: "Feedback", icon: MessageSquarePlus },
];

const navItemClass =
  "flex w-full items-center gap-3 rounded-full px-[18px] py-[13px] text-[15px] leading-[1.4] tracking-[0.35px] text-body transition-colors hover:bg-lavender-soft hover:text-primary";

export function CustomerSidebar({ fullName, email }: { fullName: string; email: string }) {
  const pathname = usePathname();
  const activeItem = items.find((item) => item.href === pathname);
  const ActiveIcon = activeItem?.icon;

  return (
    <aside className="min-w-0 lg:w-[280px] lg:shrink-0">
      <details className="group border border-line bg-white lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3.5 font-medium text-primary">
          <span className="flex items-center gap-2">
            {ActiveIcon ? <ActiveIcon aria-hidden="true" className="size-5" /> : null}
            {activeItem?.label ?? "My account"}
          </span>
          <ChevronDown aria-hidden="true" className="size-5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-line p-3">
          <CustomerSidebarNavList pathname={pathname} />
        </div>
      </details>
      <nav aria-label="Customer" className="hidden flex-col gap-1.5 lg:flex">
        <div className="mb-1.5 flex items-center gap-3.5 bg-lavender-soft p-[22px]">
          <span
            aria-hidden
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-medium tracking-[0.35px] text-white"
          >
            {initialsOf(fullName)}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate font-serif text-lg leading-[1.35] text-primary">{fullName}</p>
            <p className="truncate text-xs tracking-[0.35px] text-muted">{email}</p>
          </div>
        </div>
        <CustomerSidebarNavList pathname={pathname} />
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
    <ul className={cn("flex flex-col gap-1.5", className)}>
      {items.map((item) => {
        const active = item.href === pathname;
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(navItemClass, active && "bg-lavender font-medium text-primary")}
              href={item.href}
            >
              <Icon aria-hidden="true" className="size-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          </li>
        );
      })}
      <li aria-hidden className="my-1.5 h-px bg-line" />
      <li>
        <SignOutButton
          action={signOut}
          className={cn(navItemClass, "justify-start font-normal hover:no-underline")}
          icon={<LogOut aria-hidden="true" className="size-5" strokeWidth={1.5} />}
        />
      </li>
    </ul>
  );
}
