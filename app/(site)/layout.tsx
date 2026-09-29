import { Suspense } from "react";

import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { CustomerSidebarShell } from "@/components/features/customer/customer-sidebar-shell";
import { CustomerSidebar } from "@/components/features/customer/customer-sidebar";
import { Header } from "@/components/shared/header";
import { SessionNav } from "@/components/shared/session-nav";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut } from "@/app/actions";
import { currentVisitor } from "@/lib/customer/current-visitor";

const desktopSessionClass = "flex items-center gap-5";
const mobileSessionClass =
  "flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface";

async function CartSessionSyncGate() {
  const visitor = await currentVisitor();
  const customerId = visitor.state === "customer" ? visitor.customer.userId : undefined;
  return <CartSessionSync customerId={customerId} />;
}

async function SessionNavAsync({ className }: { className: string }) {
  const visitor = await currentVisitor();
  return <SessionNav visitor={visitor} className={className} />;
}

function SessionNavFallback({ className }: { className: string }) {
  return (
    <div className={className}>
      <Skeleton className="size-5 rounded-full" />
    </div>
  );
}

async function HeaderSignOutAsync() {
  const visitor = await currentVisitor();
  return visitor.state !== "signed-out" ? <SignOutButton action={signOut} /> : null;
}

async function CustomerSidebarGate() {
  const visitor = await currentVisitor();
  return visitor.state === "customer" ? <CustomerSidebar /> : null;
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
        headerSignOut={
          <Suspense fallback={null}>
            <HeaderSignOutAsync />
          </Suspense>
        }
        mobileSession={
          <Suspense fallback={<SessionNavFallback className={mobileSessionClass} />}>
            <SessionNavAsync className={mobileSessionClass} />
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
    </>
  );
}
