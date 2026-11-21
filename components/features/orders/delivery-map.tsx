import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { embeddableTrackingUrl, isDelivered, orderHref, type Delivery } from "@/lib/orders/deliveries";

/**
 * The courier's live map for one Order, shown from the booking share link alone (no courier API). Once Staff mark the
 * Order delivered, Go to order leads to it, where the Delivery photo and "I received my order" are.
 */
export function DeliveryMap({ delivery }: { delivery: Delivery }) {
  const delivered = isDelivered(delivery);
  const embed = embeddableTrackingUrl(delivery.trackingUrl);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild size="pill-sm" variant="pill-outline">
          <Link href="/profile/delivery">
            <ArrowLeft aria-hidden className="size-4" /> Back to deliveries
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="border border-line bg-white px-3 py-2 text-sm text-ink">{delivery.courier}</span>
          {delivered ? (
            <Button asChild size="pill-sm" variant="pill">
              <Link href={orderHref(delivery.id)}>
                Go to order <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
      {delivered ? (
        <p role="status" className="border border-lavender bg-lavender-soft p-4 text-sm text-primary">
          Your Order #{delivery.id} has been delivered. Open it to see the Delivery photo and confirm you received it.
        </p>
      ) : null}
      {embed ? (
        <iframe
          className="h-[calc(100dvh-280px)] min-h-[420px] w-full border border-line bg-white"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-same-origin allow-popups"
          src={embed}
          title={`Live delivery map for Order #${delivery.id}`}
        />
      ) : null}
      <p className="text-xs text-muted">
        {embed ? "The map comes from the courier and may stop updating after delivery. Not loading? " : "This tracking link opens on the courier's site. "}
        <a className="inline-flex items-center gap-1 text-primary underline underline-offset-4" href={delivery.trackingUrl} rel="noopener noreferrer" target="_blank">
          Open in {delivery.courier} <ExternalLink aria-hidden className="size-3" />
        </a>
      </p>
    </div>
  );
}
