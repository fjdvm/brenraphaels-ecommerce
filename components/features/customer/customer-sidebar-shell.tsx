"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { shouldShowCustomerSidebar } from "@/components/features/customer/customer-sidebar-routes";

export { shouldShowCustomerSidebar } from "@/components/features/customer/customer-sidebar-routes";

export function CustomerSidebarShell({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  const pathname = usePathname();

  if (!shouldShowCustomerSidebar(pathname)) {
    return children;
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1440px] flex-col gap-8 px-5 pb-[100px] pt-8 sm:px-10 lg:flex-row lg:gap-[60px] lg:pt-[50px]">
      <div className="lg:shrink-0">{sidebar}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
