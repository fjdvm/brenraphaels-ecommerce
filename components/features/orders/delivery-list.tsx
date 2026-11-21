import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPlacedAt } from "@/lib/orders/order-view";
import { isDelivered, orderHref, trackHref, type Delivery } from "@/lib/orders/deliveries";
import { cn } from "@/lib/utils";

const statusText: Record<Delivery["status"], string> = { dispatched: "Out for delivery", delivered: "Delivered", received: "Received" };

/** One card per Order with a courier share link: Track Order while it is on the way, Go to order once delivered. */
export function DeliveryList({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <ul aria-label="Deliveries" className="flex flex-col gap-5">
      {deliveries.map((delivery) => (
        <li key={delivery.id}>
          <DeliveryCard delivery={delivery} />
        </li>
      ))}
    </ul>
  );
}

function DeliveryCard({ delivery }: { delivery: Delivery }) {
  const delivered = isDelivered(delivery);
  return (
    <article aria-label={`Order #${delivery.id}`} className="flex flex-col gap-5 border border-line bg-white p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div className="flex min-w-0 flex-col gap-2">
        <h2 className="font-serif text-[22px] leading-[1.3] text-primary">Order #{delivery.id}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-medium tracking-[0.35px]", delivered ? "bg-surface-soft text-body" : "bg-lavender text-primary")}>
            {statusText[delivery.status]}
          </span>
          <span className="border border-line bg-white px-3 py-1 text-xs text-ink">{delivery.courier}</span>
        </div>
        <p className="text-xs tracking-[0.35px] text-muted">{delivery.summary}</p>
        {delivery.deliveredAt ? <p className="text-xs tracking-[0.35px] text-muted">Delivered {formatPlacedAt(delivery.deliveredAt)}</p> : null}
      </div>
      {delivered ? (
        <Button asChild className="shrink-0" size="pill-sm" variant="pill">
          <Link href={orderHref(delivery.id)}>
            Go to order <ArrowRight aria-hidden className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button asChild className="shrink-0" size="pill-sm" variant="pill">
          <Link href={trackHref(delivery.id)}>
            <MapPin aria-hidden className="size-4" /> Track Order
          </Link>
        </Button>
      )}
    </article>
  );
}
