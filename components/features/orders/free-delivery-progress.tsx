import { formatPeso } from "@/lib/catalog/currency";
import { amountToFreeDelivery, freeDeliveryProgressPercent } from "@/lib/orders/free-delivery";

/** Tells a Delivery Customer how far their subtotal is from Free delivery. */
export function FreeDeliveryProgress({ subtotalInCentavos }: { subtotalInCentavos: number }) {
  const percent = freeDeliveryProgressPercent(subtotalInCentavos);

  return (
    <div className="flex flex-col gap-1.5 pt-3">
      <p className="text-[13px] font-medium leading-[1.4] tracking-wide text-primary">
        Add {formatPeso(amountToFreeDelivery(subtotalInCentavos))} more for free delivery
      </p>
      <div
        aria-label="Progress toward free delivery"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent}
        className="h-1.5 w-full bg-surface"
        role="progressbar"
      >
        <div className="h-1.5 bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs tracking-wide text-muted">Free delivery on orders over ₱2,500</p>
    </div>
  );
}
