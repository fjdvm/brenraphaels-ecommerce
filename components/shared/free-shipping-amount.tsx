import { loadFreeDeliveryThreshold } from "@/lib/orders/free-delivery-threshold";
import { freeShippingThreshold } from "@/lib/site/store-info";

/** "₱4,000" for 400000 centavos; cents only when there are some. */
export function formatFreeShippingAmount(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString("en-PH", { minimumFractionDigits: centavos % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}

/**
 * The amount in the banner: the Free delivery threshold a Manager or the CEO saved in CREOMS, read fresh on each render.
 * When it cannot be read the banner keeps the shop's standing amount instead of going blank.
 */
export async function FreeShippingAmount(): Promise<string> {
  const centavos = await loadFreeDeliveryThreshold();
  return formatFreeShippingAmount(centavos ?? freeShippingThreshold * 100);
}
