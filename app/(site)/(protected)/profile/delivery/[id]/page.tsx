import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DeliveryMapSkeleton } from "@/components/features/customer/skeletons";
import { DeliveryMap } from "@/components/features/orders/delivery-map";
import { LiveOrders } from "@/components/features/orders/live-orders";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createDeliveryReader } from "@/lib/orders/deliveries";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "Track Order" };

export const dynamic = "force-dynamic";

/** Only the Customer's own Order with a share link; anything else is not found. */
async function DeliveryMapContent({ params }: { params: PageProps<"/profile/delivery/[id]">["params"] }) {
  const { id } = await params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) notFound();
  const customer = await requireCustomer();
  const delivery = await createDeliveryReader(getDatabase()).getForCustomer(customer.userId, orderId.data);
  if (!delivery) notFound();

  return (
    <>
      <LiveOrders />
      <DeliveryMap delivery={delivery} />
    </>
  );
}

export default function TrackOrderPage({ params }: PageProps<"/profile/delivery/[id]">) {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="Delivery" title="Track Order" />
      <Suspense fallback={<DeliveryMapSkeleton />}>
        <DeliveryMapContent params={params} />
      </Suspense>
    </section>
  );
}
