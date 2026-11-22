import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaymentProofCards } from "@/components/features/orders/payment-proof-cards";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { orderTotalInCentavos } from "@/lib/orders/order-view";
import { createOrderStore } from "@/lib/orders/orders";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "Payment proofs" };

export const dynamic = "force-dynamic";

export default async function PaymentProofsPage({ params }: PageProps<"/profile/orders/[id]/payment-proofs">) {
  const { id } = await params;
  const orderId = positiveIntegerField("Order ID").safeParse(id);
  if (!orderId.success) notFound();

  const customer = await requireCustomer();
  const store = createOrderStore(getDatabase());
  const order = (await store.listForCustomer(customer.userId)).find((candidate) => candidate.id === orderId.data);
  if (!order) notFound();
  const proofs = await store.listPaymentProofs(customer.userId, order.id);

  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow={`Order #${order.id}`} title="Payment proofs">
        <Link className="text-sm font-medium text-primary hover:underline" href={`/profile/orders?order=${order.id}`} prefetch>← Back to order</Link>
      </PageHeading>
      {proofs.length === 0 ? (
        <p className="text-sm text-muted">No payment proof has been sent for this order yet.</p>
      ) : (
        <PaymentProofCards awaitingCheck={order.status === "awaiting payment"} order={{ totalInCentavos: orderTotalInCentavos(order), placedAt: order.createdAt }} orderId={order.id} proofs={proofs} />
      )}
    </section>
  );
}
