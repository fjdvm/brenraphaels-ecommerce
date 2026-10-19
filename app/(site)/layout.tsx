import { Bell } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { ChatLinks } from "@/components/shared/chat-links";
import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { CustomerSidebarShell } from "@/components/features/customer/customer-sidebar-shell";
import { CustomerSidebar } from "@/components/features/customer/customer-sidebar";
import { Header } from "@/components/shared/header";
import { PageTransition } from "@/components/shared/page-transition";
import { SessionNav } from "@/components/shared/session-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";

const desktopSessionClass = "flex items-center gap-5";
const mobileSessionClass =
  "flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface";

async function CartSessionSyncGate() {
  const visitor = await currentVisitor();
  const customerId = visitor.state === "customer" ? visitor.customer.userId : undefined;
  return <CartSessionSync customerId={customerId} />;
}

async function SessionNavAsync({ className, showCart }: { className: string; showCart?: boolean }) {
  const visitor = await currentVisitor();
  return <SessionNav visitor={visitor} className={className} showCart={showCart} />;
}

/** Mirrors SessionNav's cart icon plus profile-icon/"Sign in" slot so the header doesn't reflow once resolved. */
function SessionNavFallback({ className, showCart = true }: { className: string; showCart?: boolean }) {
  return (
    <div className={className} aria-hidden="true">
      {showCart && <Skeleton className="size-5 shrink-0 rounded-full" />}
      <Skeleton className="h-4 w-14" />
    </div>
  );
}

/** The signed-in Customer's bell in the mobile top bar, beside the cart. */
async function MobileBellAsync() {
  const visitor = await currentVisitor();
  return visitor.state === "customer" ? (
    <Link href="/profile/notifications" aria-label="Notifications" className="p-2">
      <Bell />
    </Link>
  ) : null;
}

async function CustomerSidebarGate() {
  const visitor = await currentVisitor();
  return visitor.state === "customer" ? (
    <CustomerSidebar fullName={visitor.customer.fullName} email={visitor.customer.email} />
  ) : null;
}

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <CartSessionSyncGate />
      </Suspense>
      <Header
        desktopSession={
          <Suspense fallback={<SessionNavFallback className={desktopSessionClass} />}>
            <SessionNavAsync className={desktopSessionClass} />
          </Suspense>
        }
        mobileBell={
          <Suspense fallback={null}>
            <MobileBellAsync />
          </Suspense>
        }
        mobileSession={
          <Suspense fallback={<SessionNavFallback className={mobileSessionClass} showCart={false} />}>
            <SessionNavAsync className={mobileSessionClass} showCart={false} />
          </Suspense>
        }
      />
      <main className="flex-1">
        <CustomerSidebarShell
          sidebar={
            <Suspense fallback={null}>
              <CustomerSidebarGate />
            </Suspense>
          }
        >
          {children}
        </CustomerSidebarShell>
      </main>
      <Footer />
      <ChatLinks />
      <PageTransition />
    </>
  );
}
