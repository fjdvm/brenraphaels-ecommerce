import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
import { DeliveriesSkeleton } from "@/components/features/customer/skeletons";
import { DeliveryList } from "@/components/features/orders/delivery-list";
import { LiveOrders } from "@/components/features/orders/live-orders";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createDeliveryReader } from "@/lib/orders/deliveries";

export const metadata: Metadata = { title: "Delivery" };

export const dynamic = "force-dynamic";

/** The Customer's Orders with a courier share link; the live socket refreshes them when Staff mark one delivered. */
async function DeliveriesContent() {
  const customer = await requireCustomer();
  const deliveries = await createDeliveryReader(getDatabase()).listForCustomer(customer.userId);

  return (
    <>
      <LiveOrders />
      {deliveries.length === 0 ? (
        <AccountEmptyState title="No deliveries on the way" description="Once your Order is out for delivery with Lalamove or Grab, you can track the rider here.">
          <Button asChild className="mt-2" size="pill-lg" variant="pill">
            <Link href="/profile/orders">View my orders</Link>
          </Button>
        </AccountEmptyState>
      ) : (
        <DeliveryList deliveries={deliveries} />
      )}
    </>
  );
}

export default function DeliveryPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="Delivery" />
      <Suspense fallback={<DeliveriesSkeleton />}>
        <DeliveriesContent />
      </Suspense>
    </section>
  );
}
