import { Suspense } from "react";

import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { Header } from "@/components/shared/header";
import { SessionNav, SessionNavFallback } from "@/components/shared/session-nav";
import { currentVisitor } from "@/lib/customer/current-visitor";

/** Resolves the session only inside its own boundary, so it never blocks the page. */
async function CartSync() {
  const visitor = await currentVisitor();
  return (
    <CartSessionSync customerId={visitor.state === "customer" ? visitor.customer.userId : undefined} />
  );
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <CartSync />
      </Suspense>
      <Header
        desktopSession={
          <Suspense
            fallback={
              <SessionNavFallback className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex" />
            }
          >
            <SessionNav className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex" />
          </Suspense>
        }
        mobileSession={
          <Suspense
            fallback={
              <SessionNavFallback className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface" />
            }
          >
            <SessionNav className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface" />
          </Suspense>
        }
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
