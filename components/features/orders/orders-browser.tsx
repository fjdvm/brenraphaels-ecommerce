"use client";

import { Calendar, Check, ChevronDown, Store, Truck, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CartThumbnail } from "@/components/features/orders/cart-thumbnail";
import { CancelOrderForm, MessageUsLink } from "@/components/features/orders/cancel-order-form";
import { OrderFeedbackForm, type GivenFeedback } from "@/components/features/orders/order-feedback-form";
import { PaymentProofForm } from "@/components/features/orders/payment-proof-form";
import { formatPeso } from "@/lib/catalog/currency";
import {
  formatPlacedAt,
  needsPayment,
  orderBadges,
  orderFilterOf,
  orderTotalInCentavos,
  orderTrackerSteps,
  type OrderBadge,
  type OrderFilter,
} from "@/lib/orders/order-view";
import type { Order } from "@/lib/orders/orders";
import { cn } from "@/lib/utils";

export type OrderFeedbackSummary = GivenFeedback;
export type OrderWithFeedback = { order: Order; feedback: OrderFeedbackSummary | null };

const filters: { id: "all" | OrderFilter; label: string; counted: boolean }[] = [
  { id: "all", label: "All", counted: true },
  { id: "to-pay", label: "To pay", counted: true },
  { id: "processing", label: "Processing", counted: true },
  { id: "on-the-way", label: "Ready / On the way", counted: false },
  { id: "completed", label: "Completed", counted: true },
  { id: "cancelled", label: "Cancelled", counted: false },
];

const badgeClass: Record<OrderBadge["tone"], string> = {
  lavender: "bg-lavender text-primary",
  neutral: "bg-surface-soft text-body",
  warning: "bg-warning-soft text-warning",
};

/** The My orders list: filter chips over expandable Order cards. */
export function OrdersBrowser({ orders, focusOrderId }: { orders: OrderWithFeedback[]; focusOrderId?: number }) {
  const [filter, setFilter] = useState<"all" | OrderFilter>("all");
  const [openIds, setOpenIds] = useState<Set<number>>(() => {
    const ids = new Set(orders.slice(0, 1).map(({ order }) => order.id));
    // A Feedback request links here with ?order=: open that Order's card so its form shows.
    const linked = orders.find(({ order }) => order.id === focusOrderId);
    if (linked) ids.add(linked.order.id);
    return ids;
  });

  useEffect(() => {
    if (focusOrderId !== undefined) document.getElementById(`order-${focusOrderId}-feedback`)?.scrollIntoView?.({ block: "center" });
  }, [focusOrderId]);

  const counts = new Map<string, number>([["all", orders.length]]);
  for (const { order } of orders) counts.set(orderFilterOf(order), (counts.get(orderFilterOf(order)) ?? 0) + 1);
  const visible = orders.filter(({ order }) => filter === "all" || orderFilterOf(order) === filter);

  function toggle(id: number) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-[30px]">
      <div aria-label="Filter orders" className="flex flex-wrap gap-2.5" role="group">
        {filters.map(({ id, label, counted }) => {
          const active = filter === id;
          const count = counts.get(id) ?? 0;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 rounded-full border px-[18px] py-[9px] text-sm font-medium tracking-[0.45px] transition-colors",
                active ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:bg-lavender-soft",
              )}
              key={id}
              onClick={() => setFilter(id)}
              type="button"
            >
              {label}
              {counted && count > 0 ? (
                <span className={cn("text-xs font-normal", active ? "text-accent" : "text-muted")}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-[40px] border border-line bg-white p-10 text-body" role="status">
          No orders in this view.
        </p>
      ) : (
        visible.map(({ order, feedback }) => (
          <OrderCard feedback={feedback} key={order.id} onToggle={() => toggle(order.id)} open={openIds.has(order.id)} order={order} />
        ))
      )}
    </div>
  );
}

function Badge({ badge }: { badge: OrderBadge }) {
  return (
    <span className={cn("rounded-full px-3 py-1 text-xs font-medium tracking-[0.35px]", badgeClass[badge.tone])}>{badge.text}</span>
  );
}

function orderTotal(order: Order) {
  const total = orderTotalInCentavos(order);
  return order.fulfillmentMethod === "delivery" && order.deliveryFeeInCentavos === null
    ? `${formatPeso(total)} + delivery`
    : formatPeso(total);
}

function OrderCard({
  order,
  feedback,
  open,
  onToggle,
}: {
  order: Order;
  feedback: OrderFeedbackSummary | null;
  open: boolean;
  onToggle: () => void;
}) {
  const badges = orderBadges(order);
  const cancellable = !["dispatched", "delivered", "cancelled"].includes(order.status);
  const firstLine = order.lines[0];
  const summary = order.lines.map((line) => `${line.productName} · ${line.sizeLabel} × ${line.quantity}`).join("  ·  ");
  const detailsId = `order-${order.id}-details`;

  return (
    <article className="flex flex-col gap-6 rounded-[40px] border border-line bg-white p-6 sm:p-10">
      <div className="flex items-start gap-3.5">
        {!open && firstLine ? <CartThumbnail size={64} url={firstLine.imageUrl} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className={cn("font-serif text-primary", open ? "text-[28px] leading-[1.25]" : "text-[22px] leading-[1.3]")}>
            Order #{order.id}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => <Badge badge={badge} key={badge.text} />)}
          </div>
          {open ? (
            <p className="text-xs tracking-[0.35px] text-muted">Placed {formatPlacedAt(order.createdAt)}</p>
          ) : (
            <>
              <p className="text-xs tracking-[0.35px] text-muted">{summary}</p>
              <p className="font-serif text-[22px] leading-[1.3] text-ink sm:hidden">{orderTotal(order)}</p>
            </>
          )}
        </div>
        {!open ? <p className="hidden font-serif text-[22px] leading-[1.3] text-ink sm:block">{orderTotal(order)}</p> : null}
        <button
          aria-controls={detailsId}
          aria-expanded={open}
          aria-label={open ? `Hide details for Order #${order.id}` : `Show details for Order #${order.id}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition-colors hover:bg-lavender-soft"
          onClick={onToggle}
          type="button"
        >
          <ChevronDown aria-hidden className={cn("size-[18px] transition-transform", open && "rotate-180")} />
        </button>
      </div>
      {open ? <OrderDetails detailsId={detailsId} feedback={feedback} order={order} cancellable={cancellable} /> : null}
    </article>
  );
}

function OrderDetails({
  order,
  feedback,
  cancellable,
  detailsId,
}: {
  order: Order;
  feedback: OrderFeedbackSummary | null;
  cancellable: boolean;
  detailsId: string;
}) {
  const steps = orderTrackerSteps(order);
  const pickup = order.fulfillmentMethod === "pickup";
  const address = order.deliveryAddress;
  const feePending = !pickup && order.deliveryFeeInCentavos === null;
  const total = orderTotalInCentavos(order);
  const payment = order.paymentMethod === "gcash" ? "GCash" : "Cash on Delivery";
  const paymentNote = order.paymentMethod !== "gcash" ? "" : order.paymentProof ? " · reference submitted" : " · awaiting reference";

  return (
    <div className="flex flex-col gap-6" id={detailsId}>
      {steps ? (
        <ol aria-label="Order progress" className="flex">
          {steps.map((step, index) => (
            <li aria-current={step.state === "current" ? "step" : undefined} className="flex min-w-0 flex-1 flex-col items-center gap-2" key={step.label}>
              <div className="flex w-full items-center">
                <span className={cn("h-0.5 flex-1", index === 0 ? "bg-transparent" : steps[index - 1].state === "done" ? "bg-primary" : "bg-line")} />
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full",
                    step.state === "done" && "bg-primary text-white",
                    step.state === "current" && "border-[6px] border-primary bg-white",
                    step.state === "upcoming" && "border-2 border-line bg-white",
                  )}
                >
                  {step.state === "done" ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className={cn("h-0.5 flex-1", index === steps.length - 1 ? "bg-transparent" : step.state === "done" ? "bg-primary" : "bg-line")} />
              </div>
              <span
                className={cn(
                  "text-center text-xs tracking-[0.35px]",
                  step.state === "current" ? "text-sm font-medium text-primary" : step.state === "done" ? "text-ink" : "text-muted",
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      ) : null}

      <dl className="grid gap-5 md:grid-cols-3">
        <MetaCard icon={pickup ? <Store aria-hidden className="size-5 text-primary" strokeWidth={1.5} /> : <Truck aria-hidden className="size-5 text-primary" strokeWidth={1.5} />} label="Fulfilment">
          {pickup ? "Store pickup · Antipolo" : "Delivery"}
        </MetaCard>
        <MetaCard icon={<Wallet aria-hidden className="size-5 text-primary" strokeWidth={1.5} />} label="Payment">
          {payment}{paymentNote}
        </MetaCard>
        <MetaCard icon={<Calendar aria-hidden className="size-5 text-primary" strokeWidth={1.5} />} label={pickup ? "Pickup" : "Deliver to"}>
          {pickup ? "Mon–Sat, 9:00am – 6:00pm" : address ? `${address.street}, ${address.barangay}, ${address.city}` : "Address on file"}
        </MetaCard>
      </dl>

      <ul className="flex flex-col gap-4">
        {order.lines.map((line) => (
          <li className="flex items-center gap-4" key={`${order.id}-${line.productName}-${line.sizeLabel}`}>
            <CartThumbnail size={64} url={line.imageUrl} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm font-medium tracking-[0.35px] text-ink">{line.productName}</p>
              <p className="whitespace-pre text-xs tracking-[0.35px] text-muted">{`${line.sizeLabel}  ×  ${line.quantity}`}</p>
            </div>
            <p className="text-sm font-medium tracking-[0.35px] text-ink">{formatPeso(line.priceInCentavos * line.quantity)}</p>
          </li>
        ))}
      </ul>

      <div className="h-px bg-line" />
      <dl className="flex flex-col gap-2 text-sm tracking-[0.35px] text-body">
        <Row label="Subtotal">{formatPeso(order.subtotalInCentavos)}</Row>
        <Row label={pickup ? "Pickup" : "Delivery fee"}>
          {pickup ? "Free" : feePending ? "To be confirmed" : formatPeso(order.deliveryFeeInCentavos ?? 0)}
        </Row>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-ink">Total</dt>
          <dd className="font-serif text-[22px] leading-[1.3] text-primary">{feePending ? `${formatPeso(total)} + delivery` : formatPeso(total)}</dd>
        </div>
      </dl>
      {feePending ? <p className="text-right text-xs text-warning">We&apos;ll confirm the delivery fee shortly</p> : null}

      {needsPayment(order) ? <PaymentProofForm amountInCentavos={total} orderId={order.id} /> : null}
      {order.paymentProof ? (
        <p className="text-sm text-body">
          GCash reference {order.paymentProof.gcashReferenceNumber} submitted.
          {order.status === "awaiting payment" ? " We'll email you once it's verified." : null}
        </p>
      ) : null}

      {order.status === "delivered" ? <OrderFeedbackForm feedback={feedback} orderId={order.id} /> : null}

      {cancellable ? (
        <CancelOrderForm orderId={order.id} />
      ) : (
        <div className="flex justify-end">
          <MessageUsLink orderId={order.id} />
        </div>
      )}
    </div>
  );
}

function MetaCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[3px] bg-surface-soft p-[18px]">
      {icon}
      <div className="flex min-w-0 flex-col gap-0.5 tracking-[0.35px]">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-sm font-medium text-ink">{children}</dd>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
