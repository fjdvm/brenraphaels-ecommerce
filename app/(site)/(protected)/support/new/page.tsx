import type { Metadata } from "next";
import { Suspense } from "react";

import { NewTicketSkeleton } from "@/components/features/support/skeletons";
import { OpenTicketForm } from "@/components/features/support/open-ticket-form";
import { formatPeso } from "@/lib/catalog/currency";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { orderTotalInCentavos } from "@/lib/orders/order-view";
import { createOrderStore } from "@/lib/orders/orders";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "New ticket" };
export const dynamic = "force-dynamic";

const orderDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

async function NewTicketContent({ searchParams }: { searchParams: PageProps<"/support/new">["searchParams"] }) {
  const { order, followUp } = await searchParams;
  const customer = await requireCustomer();
  const database = getDatabase();
  const orders = await createOrderStore(database).listForCustomer(customer.userId);
  const requested = positiveIntegerField("Order ID").safeParse(Array.isArray(order) ? order[0] : order);
  // A Follow-up only pre-fills from the Customer's own Completed Ticket; anything else opens a plain new Ticket.
  const followUpId = positiveIntegerField("Ticket ID").safeParse(Array.isArray(followUp) ? followUp[0] : followUp);
  const earlier = followUpId.success ? await createTicketStore(database).get(followUpId.data, customer.userId) : undefined;
  const followingUp = earlier?.status === "completed" ? earlier : undefined;

  return (
    <OpenTicketForm
      defaultCategory={followingUp?.category}
      defaultOrderId={followingUp?.orderId ?? (requested.success ? requested.data : undefined)}
      followUpOfId={followingUp?.id}
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
