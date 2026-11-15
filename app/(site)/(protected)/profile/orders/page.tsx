import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
import { OrdersSkeleton } from "@/components/features/customer/skeletons";
import { LiveOrders } from "@/components/features/orders/live-orders";
import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderFeedbackStore } from "@/lib/orders/feedback";
import { createOrderReceiptStore } from "@/lib/orders/receipt";
import { paymentDetails } from "@/lib/orders/payment-details";
import { createOrderStore } from "@/lib/orders/orders";
import { listCustomerReturns } from "@/lib/returns/customer-reads";
import { createReturnOfferStore } from "@/lib/returns/return-offers";

export const metadata: Metadata = { title: "My orders" };

export const dynamic = "force-dynamic";

async function OrdersPageContent({ searchParams }: { searchParams: PageProps<"/profile/orders">["searchParams"] }) {
  const { order: orderParam } = await searchParams;
  const focusOrderId = typeof orderParam === "string" && /^\d+$/.test(orderParam) ? Number(orderParam) : undefined;
  const customer = await requireCustomer();
  const orders = await createOrderStore(getDatabase()).listForCustomer(customer.userId);
  const feedbackStore = createOrderFeedbackStore(getDatabase());
  const withReturnInProgress = await createOrderReceiptStore(getDatabase()).orderIdsWithReturnInProgress(customer.userId);
  const returnOffers = await createReturnOfferStore(getDatabase()).forCustomer(customer.userId, orders);
  const returns = await listCustomerReturns(getDatabase(), customer.userId);
  const withFeedback = await Promise.all(
    orders.map(async (order) => {
      const feedback = (order.status === "delivered" || order.status === "received") ? await feedbackStore.forOrder(customer.userId, order.id) : undefined;
      return { order, feedback: feedback ? { rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt } : null, returnInProgress: withReturnInProgress.has(order.id), returnOffer: returnOffers.get(order.id) ?? null };
    }),
  );

  if (orders.length === 0) {
    return (
      <>
        <LiveOrders />
        <AccountEmptyState title="No orders yet" description="Your past and upcoming orders will appear here.">
          <Button asChild className="mt-2" size="pill-lg" variant="pill">
            <Link href="/products">Shop now</Link>
          </Button>
        </AccountEmptyState>
      </>
    );
  }

  return (
    <>
      <LiveOrders />
      <OrdersBrowser paymentDetails={paymentDetails()} focusOrderId={focusOrderId} orders={withFeedback} returns={returns} />
    </>
  );
}

export default function OrdersPage({ searchParams }: PageProps<"/profile/orders">) {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="My orders" />
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersPageContent searchParams={searchParams} />
      </Suspense>
    </section>
  );
}
