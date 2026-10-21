import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
import { OrdersSkeleton } from "@/components/features/customer/skeletons";
import { OrdersBrowser } from "@/components/features/orders/orders-browser";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderFeedbackStore } from "@/lib/orders/feedback";
import { createOrderStore } from "@/lib/orders/orders";

export const metadata: Metadata = { title: "My orders" };

export const dynamic = "force-dynamic";

async function OrdersPageContent() {
  const customer = await requireCustomer();
  const orders = await createOrderStore(getDatabase()).listForCustomer(customer.userId);
  const feedbackStore = createOrderFeedbackStore(getDatabase());
  const withFeedback = await Promise.all(
    orders.map(async (order) => {
      const feedback = order.status === "delivered" ? await feedbackStore.forOrder(customer.userId, order.id) : undefined;
      return { order, feedback: feedback ? { rating: feedback.rating, comment: feedback.comment, createdAt: feedback.createdAt } : null };
    }),
  );

  if (orders.length === 0) {
    return (
      <AccountEmptyState title="No orders yet" description="Your past and upcoming orders will appear here.">
        <Button asChild className="mt-2" size="pill-lg" variant="pill">
          <Link href="/products">Shop now</Link>
        </Button>
      </AccountEmptyState>
    );
  }

  return <OrdersBrowser orders={withFeedback} />;
}

export default function OrdersPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="My orders" />
      <Suspense fallback={<OrdersSkeleton />}>
        <OrdersPageContent />
      </Suspense>
    </section>
  );
}
