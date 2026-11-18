import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { CheckoutSkeleton } from "@/components/features/orders/checkout-skeleton";
import { OrderPlacedView } from "@/components/features/orders/order-placed";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";
import { loadPaymentAccounts } from "@/lib/orders/payment-accounts";
import { loadPickupInstructions } from "@/lib/pickup/instructions";

export const metadata: Metadata = { title: "Order placed" };
export const dynamic = "force-dynamic";

async function OrderPlacedContent({ params }: { params: PageProps<"/checkout/placed/[id]">["params"] }) {
  const { id } = await params;
  if (!/^\d{1,9}$/.test(id)) notFound();
  const customer = await requireCustomer();
  const orders = await createOrderStore(getDatabase()).listForCustomer(customer.userId);
  const order = orders.find((candidate) => candidate.id === Number(id));
  if (!order) notFound();

  const pickup = order.fulfillmentMethod === "pickup" ? await loadPickupInstructions() : null;
  return <OrderPlacedView order={order} accounts={await loadPaymentAccounts()} firstName={customer.firstName} pickup={pickup} />;
}

export default function OrderPlacedPage({ params }: PageProps<"/checkout/placed/[id]">) {
  return (
    <Suspense fallback={<CheckoutSkeleton />}>
      <OrderPlacedContent params={params} />
    </Suspense>
  );
}

