import { ArrowRight } from "lucide-react";

import type { Order } from "@/lib/orders/orders";

type Courier = NonNullable<Order["courier"]>;

/** Shown only while an Order is dispatched: the courier, and the Track button only while there is a link. Rider details are for Staff, never shown here. */
export function TrackDelivery({ courier }: { courier: Courier }) {
  const link = courier.trackingUrl;

  return (
    <section aria-label="Track your delivery" className="flex flex-col gap-4 border border-lavender bg-lavender-soft p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="border border-line bg-white px-3 py-2 text-sm text-ink">{courier.name}</span>
          <p className="font-serif text-lg text-primary">Your rider is on the way</p>
        </div>
        {link ? (
          <a
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base text-white"
            href={link}
            rel="noopener noreferrer"
            target="_blank"
          >
            Track your delivery <ArrowRight aria-hidden className="size-4" />
          </a>
        ) : null}
      </div>
      <p className="text-xs text-muted">
        {courier.trackingUrl ? `The tracking link comes from ${courier.name} and may stop working after delivery.` : "A tracking link is not available yet."}
      </p>
    </section>
  );
}
