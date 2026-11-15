import { Check } from "lucide-react";
import Link from "next/link";

import { PaymentDetailsCard } from "@/components/features/orders/payment-details-card";
import { PaymentProofForm } from "@/components/features/orders/payment-proof-form";
import { Button } from "@/components/ui/button";
import { formatPeso } from "@/lib/catalog/currency";
import { formatPlacedAt, needsPayment, orderTotalInCentavos, paymentDeadline } from "@/lib/orders/order-view";
import type { Order } from "@/lib/orders/orders";
import { isPrepaid } from "@/lib/orders/payment-methods";
import { PAYMENT_LABELS, type PaymentDetail } from "@/lib/orders/payment-details";

const STEPS = [
  { title: "Send the exact amount", note: "To the shop's account shown above" },
  { title: "Copy the reference number", note: "It's on your receipt" },
  { title: "Submit it below", note: "We'll confirm within 1 hour, Mon–Sat" },
] as const;

/** The screen after checkout: where to pay, the proof form once the Order can take it, and the summary. */
export function OrderPlacedView({ order, details, firstName }: { order: Order; details: PaymentDetail[]; firstName?: string }) {
  const label = PAYMENT_LABELS[order.paymentMethod];
  const prepaid = isPrepaid(order.paymentMethod);
  const total = orderTotalInCentavos(order);
  const feePending = order.fulfillmentMethod === "delivery" && order.deliveryFeeInCentavos === null;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-5 pb-20 pt-12 sm:px-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-success-soft"><Check aria-hidden className="size-8 text-success" /></span>
        <h1 className="font-serif text-[40px] leading-[1.2] text-primary sm:text-[54px]">Thank you{firstName ? `, ${firstName}` : ""}!</h1>
        <p className="text-base tracking-[0.35px] text-body">
          Order #{order.id} is placed.{prepaid ? ` Send your ${label} payment so we can start preparing it.` : ` You'll pay with ${label}.`}
        </p>
      </div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <section aria-labelledby="pay-heading" className="flex flex-1 flex-col gap-5 border border-line bg-white p-6 sm:px-11 sm:py-10">
          <h2 className="font-serif text-[28px] leading-tight text-primary" id="pay-heading">{prepaid ? `Pay with ${label}` : label}</h2>
          {prepaid ? (
            <>
              <PaymentDetailsCard detail={details.find((detail) => detail.method === order.paymentMethod)} />
              <ol className="flex flex-col gap-4">
                {STEPS.map((step, index) => (
                  <li className="flex items-start gap-3.5" key={step.title}>
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-medium text-white">{index + 1}</span>
                    <span className="flex flex-col gap-0.5 tracking-[0.35px]"><span className="text-sm font-medium text-ink">{step.title}</span><span className="text-xs text-body">{step.note}</span></span>
                  </li>
                ))}
              </ol>
              {needsPayment(order) ? (
                <PaymentProofForm amountInCentavos={total} deadline={formatPlacedAt(paymentDeadline(order))} method={order.paymentMethod} orderId={order.id} />
              ) : (
                <p className="text-sm text-body">
                  {order.status === "awaiting payment" ? "Your reference number was sent. We'll email you once it's verified." : "We'll confirm your Order first. Then you can submit your reference number here or in My orders."}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-body">Pay cash when {order.fulfillmentMethod === "pickup" ? "you collect" : "we deliver"} your Order. No proof is needed.</p>
          )}
          <Button asChild className="self-start" variant="link"><Link href="/profile/orders">{prepaid ? "Pay later in My orders" : "View my orders"}</Link></Button>
        </section>
        <aside aria-labelledby="placed-summary" className="flex w-full flex-col gap-4 border border-line bg-white p-8 lg:w-[460px] lg:shrink-0">
          <h2 className="font-serif text-[22px] leading-tight text-primary" id="placed-summary">Order #{order.id}</h2>
          <ul className="flex flex-col gap-3">
            {order.lines.map((line) => (
              <li className="flex items-center justify-between gap-3 text-sm tracking-[0.35px]" key={`${line.productName}-${line.sizeLabel}`}>
                <span className="flex flex-col"><span className="font-medium text-ink">{line.productName}</span><span className="text-xs text-muted">{line.sizeLabel} × {line.quantity}</span></span>
                <span className="text-ink">{formatPeso(line.priceInCentavos * line.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="flex flex-col gap-3 border-t border-line pt-3 text-sm tracking-[0.35px]">
            <div className="flex justify-between"><dt className="text-muted">{order.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}</dt><dd className="text-ink">{order.fulfillmentMethod === "pickup" ? "Free" : feePending ? "Fee to follow" : formatPeso(order.deliveryFeeInCentavos ?? 0)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Payment</dt><dd className="text-ink">{label}{prepaid ? (order.paymentProof ? " · reference sent" : " · waiting for reference") : ""}</dd></div>
            <div className="flex justify-between border-t border-line pt-3"><dt className="text-muted">Total</dt><dd className="font-serif text-lg text-primary">{feePending ? `${formatPeso(total)} + delivery` : formatPeso(total)}</dd></div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
