"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";

import { CustomerSidebar } from "@/components/features/customer/customer-sidebar";

const sidebarlessPaths = new Set(["/", "/about", "/faq", "/contact"]);

export function shouldShowCustomerSidebar(pathname: string) {
  return !sidebarlessPaths.has(pathname);
}

export function CustomerSidebarShell({
  children,
  isCustomer,
}: {
  children: ReactNode;
  isCustomer: boolean;
}) {
  const pathname = usePathname();

  if (!isCustomer || !shouldShowCustomerSidebar(pathname)) {
    return children;
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12">
      <Suspense fallback={null}>
        <CustomerSidebar />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
