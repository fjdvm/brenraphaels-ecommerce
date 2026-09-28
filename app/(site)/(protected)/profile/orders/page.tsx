import type { Metadata } from "next";
import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
import { formatPeso } from "@/lib/catalog/currency";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";

export const metadata: Metadata = { title: "My orders" };

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const customer = await requireCustomer();
  const orders = await createOrderStore(getDatabase()).listForCustomer(customer.userId);
  if (orders.length === 0) {
    return (
      <AccountEmptyState
        title="My orders"
        description="Your past and upcoming orders will appear here."
      />
    );
  }

  return (
    <section>
      <h2 className="font-serif text-3xl text-primary">My orders</h2>
      <div className="mt-6 space-y-5">
        {orders.map((order) => (
          <article key={order.id} className="rounded-md border border-outline-variant/60 bg-surface-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-serif text-2xl text-primary">Order #{order.id}</h3>
              <p className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold capitalize text-primary">{order.status}</p>
            </div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold text-on-surface-variant">Fulfillment</dt><dd className="mt-1 capitalize text-primary">{order.fulfillmentMethod}</dd></div>
              <div><dt className="font-semibold text-on-surface-variant">Payment</dt><dd className="mt-1 text-primary">{order.paymentMethod === "gcash" ? "GCash" : "Cash on Delivery"}</dd></div>
            </dl>
            <ul className="mt-5 divide-y divide-outline-variant/60 border-y border-outline-variant/60">
              {order.lines.map((line) => <li key={`${order.id}-${line.productName}-${line.sizeLabel}`} className="flex justify-between gap-4 py-3 text-sm"><span>{line.productName} · {line.sizeLabel} × {line.quantity}</span><span className="font-semibold">{formatPeso(line.priceInCentavos * line.quantity)}</span></li>)}
            </ul>
            <dl className="mt-4 space-y-1 text-right text-sm text-on-surface-variant">
              <div><dt className="inline">Subtotal: </dt><dd className="inline">{formatPeso(order.subtotalInCentavos)}</dd></div>
              {order.deliveryFeeInCentavos !== null && <div><dt className="inline">Delivery fee: </dt><dd className="inline">{formatPeso(order.deliveryFeeInCentavos)}</dd></div>}
            </dl>
            {order.fulfillmentMethod === "delivery" && order.deliveryFeeInCentavos === null ? (
              <p className="mt-1 text-right font-bold text-secondary">Total pending Delivery fee confirmation</p>
            ) : (
              <p className="mt-1 text-right font-bold text-primary">Total: {formatPeso(order.subtotalInCentavos + (order.deliveryFeeInCentavos ?? 0))}</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
