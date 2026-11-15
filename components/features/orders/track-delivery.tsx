import { ArrowRight } from "lucide-react";

import type { Order } from "@/lib/orders/orders";

type Courier = NonNullable<Order["courier"]>;

/** Shown once an Order is dispatched. The link may stop working after delivery, so the rider's details stay. */
export function TrackDelivery({ courier, status }: { courier: Courier; status: string }) {
  const live = status === "dispatched";
  const details = [
    ["Rider", courier.riderName],
    ["Plate no.", courier.riderPlate],
    ["Rider contact", courier.riderPhone],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));

  return (
    <section aria-label="Track your delivery" className="flex flex-col gap-4 border border-lavender bg-lavender-soft p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="border border-line bg-white px-3 py-2 text-sm text-ink">{courier.name}</span>
          <p className="font-serif text-lg text-primary">{live ? "Your rider is on the way" : `Delivered with ${courier.name}`}</p>
        </div>
        {live ? (
          <a
            className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base text-white"
            href={courier.trackingUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Track your delivery <ArrowRight aria-hidden className="size-4" />
          </a>
        ) : null}
      </div>
      {details.length ? (
        <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-lavender pt-4 text-sm">
          {details.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-xs text-muted">
        The tracking link comes from {courier.name} and may stop working after delivery. Your rider details stay on this page.
      </p>
    </section>
  );
}
