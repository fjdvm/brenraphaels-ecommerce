import { Suspense } from "react";

import { StorefrontToaster } from "@/components/shared/storefront-toast";

import { FreeShippingAmount } from "@/components/shared/free-shipping-amount";
import { LiveStorefront } from "@/components/features/storefront/live-storefront";
import { Footer } from "@/components/shared/footer";
import { LiveNotifications } from "@/components/features/customer/live-notifications";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { CustomerSidebarShell } from "@/components/features/customer/customer-sidebar-shell";
import { CustomerSidebar } from "@/components/features/customer/customer-sidebar";
import { Header } from "@/components/shared/header";
import { NotificationBell } from "@/components/shared/notification-bell";
import { PageTransition } from "@/components/shared/page-transition";
import { SessionNav } from "@/components/shared/session-nav";
import { Skeleton } from "@/components/ui/skeleton";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { freeShippingThreshold } from "@/lib/site/store-info";
import { unreadInboxCount } from "@/lib/notifications/inbox";

/** While the saved amount loads, the banner shows the shop's standing amount, so it never jumps or goes blank. */
const freeShippingFallback = `₱${freeShippingThreshold.toLocaleString("en-PH")}`;
const desktopSessionClass = "flex items-center gap-5";
const mobileSessionClass =
  "flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface";

async function CartSessionSyncGate() {
  const visitor = await currentVisitor();
  const customerId = visitor.state === "customer" ? visitor.customer.userId : undefined;
  return <CartSessionSync customerId={customerId} />;
}

/** The unread count for the bell; the inbox being unreachable must not take the header down, so it shows none. */
async function unreadFor(customerId: string): Promise<number> {
  try {
    return await unreadInboxCount(customerId);
  } catch (error) {
    console.error("Unread Notifications could not be counted", error);
    return 0;
  }
}

async function SessionNavAsync({ className, showCart }: { className: string; showCart?: boolean }) {
  const visitor = await currentVisitor();
  const unread = visitor.state === "customer" && showCart !== false ? await unreadFor(visitor.customer.userId) : 0;
  return <SessionNav visitor={visitor} className={className} showCart={showCart} unreadNotifications={unread} />;
}

/** Opens the Customer's live Notifications line, which refreshes the bell and the page in every open tab. */
async function LiveNotificationsGate() {
  const visitor = await currentVisitor();
  return visitor.state === "customer" ? <LiveNotifications /> : null;
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
    <NotificationBell className="relative p-2" size={24} unread={await unreadFor(visitor.customer.userId)} />
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
      <Suspense fallback={null}>
        <LiveNotificationsGate />
      </Suspense>
      <LiveStorefront />
      <Header
        freeShippingAmount={
          <Suspense fallback={freeShippingFallback}>
            <FreeShippingAmount />
          </Suspense>
        }
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
      {/* Messenger/Instagram chat buttons are hidden for now; restore <ChatLinks /> from components/shared/chat-links to show them again. */}
      <PageTransition />
      <StorefrontToaster />
    </>
  );
}
