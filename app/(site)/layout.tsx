import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { CustomerSidebarShell } from "@/components/features/customer/customer-sidebar-shell";
import { Header } from "@/components/shared/header";
import { SessionNav } from "@/components/shared/session-nav";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { signOut } from "@/app/actions";
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
            className="flex items-center gap-5"
          />
        }
        headerSignOut={
          visitor.state !== "signed-out" ? <SignOutButton action={signOut} /> : null
        }
        mobileSession={
          <SessionNav
            visitor={visitor}
            className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface"
          />
        }
      />
      <main className="flex-1">
        <CustomerSidebarShell isCustomer={visitor.state === "customer"}>
          {children}
        </CustomerSidebarShell>
      </main>
      <Footer />
    </>
  );
}
