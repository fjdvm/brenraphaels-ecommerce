import { Suspense } from "react";

import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { CustomerSidebar } from "@/components/features/customer/customer-sidebar";
import { Header } from "@/components/shared/header";
import { SessionNav } from "@/components/shared/session-nav";
import { currentVisitor } from "@/lib/customer/current-visitor";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const visitor = await currentVisitor();
  const customerId = visitor.state === "customer" ? visitor.customer.userId : undefined;

  return (
    <>
      <CartSessionSync customerId={customerId} />
      <Header
        desktopSession={
          <SessionNav
            visitor={visitor}
            className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex"
          />
        }
        mobileSession={
          <SessionNav
            visitor={visitor}
            className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface"
          />
        }
      />
      <main className="flex-1">
        {visitor.state === "customer" ? (
          <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 px-5 py-10 sm:px-8 sm:py-14 lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-12">
            <Suspense fallback={null}>
              <CustomerSidebar />
            </Suspense>
            <div className="min-w-0">{children}</div>
          </div>
        ) : children}
      </main>
      <Footer />
    </>
  );
}
