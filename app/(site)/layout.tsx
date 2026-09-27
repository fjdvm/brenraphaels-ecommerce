import { Footer } from "@/components/shared/footer";
import { CartSessionSync } from "@/components/features/orders/cart-session-sync";
import { Header } from "@/components/shared/header";
import { SessionNav } from "@/components/shared/session-nav";
import { currentVisitor } from "@/lib/customer/current-visitor";

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const visitor = await currentVisitor();
  return (
    <>
      <CartSessionSync customerId={visitor.state === "customer" ? visitor.customer.userId : undefined} />
      <Header
        desktopSession={
          <SessionNav className="hidden items-center gap-5 text-sm font-semibold text-on-surface-variant md:flex" />
        }
        mobileSession={
          <SessionNav className="flex flex-col gap-3 border-t border-outline-variant/60 pt-3 text-sm font-semibold text-on-surface" />
        }
      />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
