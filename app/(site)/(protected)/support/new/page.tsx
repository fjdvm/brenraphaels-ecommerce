import type { Metadata } from "next";
import { Suspense } from "react";

import { NewTicketSkeleton } from "@/components/features/support/skeletons";
import { OpenTicketForm } from "@/components/features/support/open-ticket-form";
import { formatPeso } from "@/lib/catalog/currency";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { orderTotalInCentavos } from "@/lib/orders/order-view";
import { createOrderStore } from "@/lib/orders/orders";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "New ticket" };
export const dynamic = "force-dynamic";

const orderDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

async function NewTicketContent({ searchParams }: { searchParams: PageProps<"/support/new">["searchParams"] }) {
  const { order } = await searchParams;
  const customer = await requireCustomer();
  const orders = await createOrderStore(getDatabase()).listForCustomer(customer.userId);
  const requested = positiveIntegerField("Order ID").safeParse(Array.isArray(order) ? order[0] : order);

  return (
    <OpenTicketForm
      defaultOrderId={requested.success ? requested.data : undefined}
      orders={orders.map((placed) => ({
        id: placed.id,
        label: `Order #${placed.id} · ${formatPeso(orderTotalInCentavos(placed))} · ${orderDate.format(placed.createdAt)}`,
      }))}
    />
  );
}

export default function NewTicketPage({ searchParams }: PageProps<"/support/new">) {
  return (
    <Suspense fallback={<NewTicketSkeleton />}>
      <NewTicketContent searchParams={searchParams} />
    </Suspense>
  );
}
