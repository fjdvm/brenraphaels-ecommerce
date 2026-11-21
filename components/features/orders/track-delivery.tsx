import Link from "next/link";
import { ExternalLink, MapPin } from "lucide-react";

import { trackHref } from "@/lib/orders/deliveries";
import type { Order } from "@/lib/orders/orders";

type Courier = NonNullable<Order["courier"]>;

/**
 * Shown only while an Order is dispatched: the courier, and while there is a share link, Track Order (the live map
 * in the Delivery tab) plus the courier's own page. Rider details are for Staff, never shown here.
 */
export function TrackDelivery({ orderId, courier }: { orderId: number; courier: Courier }) {
  const link = courier.trackingUrl;

  return (
    <section aria-label="Track your delivery" className="flex flex-col gap-4 border border-lavender bg-lavender-soft p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="border border-line bg-white px-3 py-2 text-sm text-ink">{courier.name}</span>
          <p className="font-serif text-lg text-primary">Your rider is on the way</p>
        </div>
        {link ? (
          <Link className="flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base text-white" href={trackHref(orderId)}>
            <MapPin aria-hidden className="size-4" /> Track Order
          </Link>
        ) : null}
      </div>
      {link ? (
        <p className="text-xs text-muted">
          The live map comes from {courier.name} and may stop working after delivery.{" "}
          <a className="inline-flex items-center gap-1 text-primary underline underline-offset-4" href={link} rel="noopener noreferrer" target="_blank">
            Open in {courier.name} <ExternalLink aria-hidden className="size-3" />
          </a>
        </p>
      ) : (
        <p className="text-xs text-muted">A tracking link is not available yet.</p>
      )}
    </section>
  );
}
