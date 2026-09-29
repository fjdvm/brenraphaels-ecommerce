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
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-0">
      <div>{sidebar}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
