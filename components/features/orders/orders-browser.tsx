"use client";

import { isCompleted, isCompletedOrReceived } from "@/lib/orders/completion";
import { FEE_TO_FOLLOW_SHORT } from "@/lib/orders/fee-to-follow-copy";
import { FREE_DELIVERY_CONFIRMATION_NOTICE } from "@/lib/orders/free-delivery";
import { Calendar, Check, ChevronDown, Store, Truck, Wallet } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { CartThumbnail } from "@/components/features/orders/cart-thumbnail";
import { CancelOrderForm } from "@/components/features/orders/cancel-order-form";
import { RequestCancellation } from "@/components/features/orders/request-cancellation";
import type { CancellationStatus } from "@/lib/orders/cancellation-status";
import { OrderFeedbackForm, type GivenFeedback } from "@/components/features/orders/order-feedback-form";
import { OrderReceivedButton } from "@/components/features/orders/order-received-button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrackDelivery } from "@/components/features/orders/track-delivery";
import { OrderReturn } from "@/components/features/orders/order-return";
import { ReturnsList } from "@/components/features/orders/returns-list";
import { PAYMENT_LABELS } from "@/lib/orders/payment-details";
import type { PaymentAccountOption } from "@/lib/orders/payment-offer";
import { isPrepaid } from "@/lib/orders/payment-methods";
import { ZoomableProof } from "@/components/features/orders/zoomable-proof";
import { PaymentProofForm } from "@/components/features/orders/payment-proof-form";
import { formatPeso } from "@/lib/catalog/currency";
import {
  formatPlacedAt,
  needsNewProof,
  underManagerReview,
  needsPayment,
  paymentDeadline,
  orderBadges,
  orderFilterOf,
  orderTotalInCentavos,
  orderTrackerSteps,
  type OrderBadge,
  type OrderFilter,
} from "@/lib/orders/order-view";
import { CUSTOMER_CANCELLABLE } from "@/lib/orders/customer-cancellable";
import type { Order } from "@/lib/orders/orders";
import type { CustomerReturn } from "@/lib/returns/customer-reads";
import type { ReturnOffer } from "@/lib/returns/return-offers";
import { countedReturns, returnStatusLabel } from "@/lib/returns/return-view";
import { cn } from "@/lib/utils";

export type OrderFeedbackSummary = GivenFeedback;
export type OrderWithFeedback = { order: Order; feedback: OrderFeedbackSummary | null; returnInProgress: boolean; returnOffer?: ReturnOffer | null; cancellation?: CancellationStatus | null };

type Tab = "all" | OrderFilter | "returns";

const filters: { id: Tab; label: string; counted: boolean }[] = [
  { id: "all", label: "All", counted: true },
  { id: "to-pay", label: "To pay", counted: true },
  { id: "processing", label: "Processing", counted: true },
  { id: "on-the-way", label: "Ready / On the way", counted: false },
  { id: "completed", label: "Completed", counted: true },
  { id: "cancelled", label: "Cancelled", counted: false },
  { id: "returns", label: "Returns", counted: true },
];

const badgeClass: Record<OrderBadge["tone"], string> = {
  lavender: "bg-lavender text-primary",
  neutral: "bg-surface-soft text-body",
  warning: "bg-warning-soft text-warning",
};

/** The My orders list: filter chips over expandable Order cards. */
export function OrdersBrowser({ orders, returns = [], focusOrderId, cancelFocus = false, paymentAccounts = [] }: { orders: OrderWithFeedback[]; returns?: CustomerReturn[]; focusOrderId?: number; cancelFocus?: boolean; paymentAccounts?: PaymentAccountOption[] }) {
  const [filter, setFilter] = useState<Tab>("all");
  const [scrollToReturn, setScrollToReturn] = useState<number>();
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

  useEffect(() => {
    if (scrollToReturn !== undefined) document.getElementById(`return-${scrollToReturn}`)?.scrollIntoView?.({ block: "center" });
  }, [scrollToReturn]);

  const counts = new Map<string, number>([["all", orders.length], ["returns", countedReturns(returns)]]);
  const returnsByOrder = Map.groupBy(returns, ({ orderId }) => orderId);
  for (const { order } of orders) counts.set(orderFilterOf(order), (counts.get(orderFilterOf(order)) ?? 0) + 1);
  const visible = orders.filter(({ order }) => filter === "all" || orderFilterOf(order) === filter);

  function showReturn(id: number) {
    setFilter("returns");
    setScrollToReturn(id);
  }

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
      {filter === "returns" ? (
        <ReturnsList returns={returns} />
      ) : visible.length === 0 ? (
        <p className="border border-line bg-white p-10 text-body" role="status">
          No orders in this view.
        </p>
      ) : (
        visible.map(({ order, feedback, returnInProgress, returnOffer, cancellation }) => (
          <OrderCard feedback={feedback} key={order.id} onShowReturn={showReturn} orderReturns={returnsByOrder.get(order.id) ?? []} onToggle={() => toggle(order.id)} open={openIds.has(order.id)} order={order} returnInProgress={returnInProgress} returnOffer={returnOffer ?? null} cancellation={cancellation ?? null} paymentAccounts={paymentAccounts} openCancel={cancelFocus && order.id === focusOrderId} />
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
  returnInProgress,
  returnOffer,
  cancellation,
  orderReturns,
  onShowReturn,
  onToggle,
  paymentAccounts,
  openCancel = false,
}: {
  openCancel?: boolean;
  paymentAccounts: PaymentAccountOption[];
  order: Order;
  orderReturns: CustomerReturn[];
  onShowReturn: (id: number) => void;
  feedback: OrderFeedbackSummary | null;
  returnInProgress: boolean;
  returnOffer: ReturnOffer | null;
  cancellation: CancellationStatus | null;
  open: boolean;
  onToggle: () => void;
}) {
  const badges = orderBadges(order);
  // The Customer may cancel until the Order is paid or the shop starts preparing it.
  const cancellable = CUSTOMER_CANCELLABLE.includes(order.status);
  const firstLine = order.lines[0];
  const summary = order.lines.map((line) => `${line.productName} · ${line.sizeLabel} × ${line.quantity}`).join("  ·  ");
  const detailsId = `order-${order.id}-details`;

  return (
    <article className="flex flex-col gap-6 border border-line bg-white p-6 sm:p-10">
      <div className="flex items-start gap-3.5">
        {firstLine ? <CartThumbnail size={64} url={firstLine.imageUrl} /> : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className={cn("font-serif text-primary", open ? "text-[28px] leading-[1.25]" : "text-[22px] leading-[1.3]")}>
            Order #{order.id}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => <Badge badge={badge} key={badge.text} />)}
            {orderReturns.map((entry) => (
              <a
                className="rounded-full bg-lavender-soft px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary underline-offset-4 hover:underline"
                href={`#return-${entry.id}`}
                key={entry.id}
                onClick={(event) => {
                  event.preventDefault();
                  onShowReturn(entry.id);
                }}
              >
                Return {entry.number} · {returnStatusLabel(entry.status)}
              </a>
            ))}
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
      {open ? <OrderDetails detailsId={detailsId} feedback={feedback} order={order} cancellable={cancellable} openCancel={openCancel} returnInProgress={returnInProgress} returnOffer={returnOffer} cancellation={cancellation} paymentAccounts={paymentAccounts} /> : null}
    </article>
  );
}

function OrderDetails({
  order,
  feedback,
  cancellable,
  openCancel,
  returnInProgress,
  returnOffer,
  cancellation,
  detailsId,
  paymentAccounts,
}: {
  paymentAccounts: PaymentAccountOption[];
  order: Order;
  feedback: OrderFeedbackSummary | null;
  cancellable: boolean;
  openCancel: boolean;
  returnInProgress: boolean;
  returnOffer: ReturnOffer | null;
  cancellation: CancellationStatus | null;
  detailsId: string;
}) {
  const steps = orderTrackerSteps(order);
  const pickup = order.fulfillmentMethod === "pickup";
  const address = order.deliveryAddress;
  const freeDelivery = !pickup && order.freeDelivery === true;
  const feePending = !pickup && order.deliveryFeeInCentavos === null && !freeDelivery;
  const total = orderTotalInCentavos(order);
  const payment = PAYMENT_LABELS[order.paymentMethod];
  const paymentNote = !isPrepaid(order.paymentMethod) ? "" : order.paymentProofRejection ? " · proof not accepted" : order.paymentProof ? " · reference submitted" : " · awaiting reference";

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
          {pickup ? "Store pickup · Antipolo" : fulfilmentLabel(order)}
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
          {pickup ? "Free" : freeDelivery ? "Delivery: Free" : feePending ? "To be confirmed" : formatPeso(order.deliveryFeeInCentavos ?? 0)}
        </Row>
        <div className="flex items-center justify-between">
          <dt className="font-medium text-ink">Total</dt>
          <dd className="font-serif text-[22px] leading-[1.3] text-primary">{feePending ? `${formatPeso(total)} + delivery` : formatPeso(total)}</dd>
        </div>
      </dl>
      {feePending ? <p className="text-right text-xs text-warning">{FEE_TO_FOLLOW_SHORT}</p> : null}
      {freeDelivery && order.status === "placed" ? <p className="text-right text-xs text-warning">{FREE_DELIVERY_CONFIRMATION_NOTICE}</p> : null}

      {order.courier && order.status === "dispatched" ? <TrackDelivery courier={order.courier} /> : null}

      {order.status === "delivered" || order.status === "received" ? <DeliveryPhoto fileId={order.deliveryPhotoFileId} removedAt={order.deliveryPhotoRemovedAt} orderId={order.id} /> : null}

      {needsPayment(order) || needsNewProof(order) ? (
        <PaymentProofForm
          amountInCentavos={total}
          accounts={paymentAccounts}
          method={order.paymentMethod}
          orderId={order.id}
          rejection={order.paymentProofRejection ? { reason: order.paymentProofRejection.reason } : null}
          deadline={formatPlacedAt(paymentDeadline(order))}
          placedAt={order.createdAt}
        />
      ) : null}
      {underManagerReview(order) ? (
        <div className="flex flex-col gap-1.5 bg-surface px-6 py-5 tracking-[0.35px]" data-testid="manager-review-notice" role="status">
          <p className="text-sm font-medium text-red-700">We couldn&apos;t accept your payment proof{order.paymentProofRejection?.reason ? `: ${order.paymentProofRejection.reason}` : ""}.</p>
          <p className="text-sm text-ink">Your payment is under Manager review</p>
        </div>
      ) : null}
      {order.paymentProofHistory && order.paymentProofHistory.length > 0 ? (
        <div className="flex flex-col gap-2.5 bg-surface px-6 py-5 tracking-[0.35px]" data-testid="payment-history">
          <p className="text-[13px] font-medium text-ink">Payment history</p>
          {order.paymentProofHistory.map((proof, index) => (
            <div className="flex items-start justify-between gap-4" key={`${proof.submittedAt.toISOString()}-${index}`}>
              <p className="text-sm text-ink">Proof {index + 1} · sent {formatPlacedAt(proof.submittedAt)}</p>
              <p className={proof.rejection ? "text-xs text-red-700" : "text-xs text-muted"}>
                {proof.rejection ? `Not accepted · ${proof.rejection.reason}` : order.status === "awaiting payment" ? "Being checked" : "Accepted"}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      {order.paymentProof && !needsNewProof(order) ? (
        <p className="text-sm text-body">
          {payment} reference {order.paymentProof.gcashReferenceNumber} submitted.
          {order.status === "awaiting payment" ? " We'll email you once it's verified." : null}
        </p>
      ) : null}
      {order.paymentProof && (order.paymentProof.screenshotFileId || order.paymentProof.screenshotPathname) ? (
        <ZoomableProof orderId={order.id} version={order.paymentProof.submittedAt.getTime()} />
      ) : null}

      {isCompletedOrReceived(order.status) ? <OrderFeedbackForm feedback={feedback} orderId={order.id} /> : null}

      {isCompleted(order.status) && (returnOffer || !returnInProgress) ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {returnOffer ? <OrderReturn offer={returnOffer} orderId={order.id} /> : null}
          {!returnInProgress ? <OrderReceivedButton orderId={order.id} /> : null}
        </div>
      ) : null}

      {cancellable ? (
        <CancelOrderForm defaultOpen={openCancel} orderId={order.id} />
      ) : order.status === "dispatched" || (order.status === "cancelled" && cancellation) ? (
        <div className="flex flex-col gap-3">
          <RequestCancellation orderId={order.id} request={cancellation} />
        </div>
      ) : null}
    </div>
  );
}

/** The courier is named once the Order is on its way; "Delivered · Lalamove" after. Before dispatch it is just "Delivery". */
function fulfilmentLabel(order: Order) {
  const courier = order.courier?.name;
  if (!courier) return "Delivery";
  if (order.status === "dispatched") return courier;
  return order.status === "delivered" || order.status === "received" ? `Delivered · ${courier}` : "Delivery";
}

function DeliveryPhoto({ orderId, fileId, removedAt }: { orderId: number; fileId: string | null; removedAt: Order["deliveryPhotoRemovedAt"] }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <section aria-label="Delivery photo" className="flex flex-col gap-2 bg-surface-soft p-[18px]">
      <p className="text-xs tracking-[0.35px] text-muted">Delivery photo</p>
      {fileId && failed ? (
        <p className="text-sm text-body">Photo unavailable</p>
      ) : fileId ? (
        <div className="relative max-w-sm">
          {loaded ? null : <Skeleton aria-hidden className="absolute inset-0 h-full w-full" data-testid="delivery-photo-loading" />}
          {/* eslint-disable-next-line @next/next/no-img-element -- the route redirects to a short-lived signed URL */}
          <img alt={`Delivery photo for Order #${orderId}`} className={cn("max-h-80 min-h-40 w-full object-cover", loaded ? "opacity-100" : "opacity-0")} loading="lazy" onError={() => setFailed(true)} onLoad={() => setLoaded(true)} ref={(img) => { if (img?.complete && img.naturalWidth > 0) setLoaded(true); }} src={`/api/orders/${orderId}/delivery-photo`} />
        </div>
      ) : (
        <p className="text-sm text-body">{removedAt ? "The Delivery photo was removed." : "No photo"}</p>
      )}
    </section>
  );
}

function MetaCard({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 bg-surface-soft p-[18px]">
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
