/** A Delivery Order whose subtotal is strictly over ₱2,500 has a ₱0 Delivery fee. */
export const FREE_DELIVERY_THRESHOLD_IN_CENTAVOS = 250_000;

export function qualifiesForFreeDelivery(subtotalInCentavos: number): boolean {
  return subtotalInCentavos > FREE_DELIVERY_THRESHOLD_IN_CENTAVOS;
}

/** Centavos still to add before delivery is free (at least 1, since exactly ₱2,500 is not yet free); 0 when it already is. */
export function amountToFreeDelivery(subtotalInCentavos: number): number {
  return qualifiesForFreeDelivery(subtotalInCentavos) ? 0 : Math.max(1, FREE_DELIVERY_THRESHOLD_IN_CENTAVOS - subtotalInCentavos);
}

/** Whole percent of the way to Free delivery, for the progress bar. */
export function freeDeliveryProgressPercent(subtotalInCentavos: number): number {
  return Math.min(100, Math.max(0, Math.floor((subtotalInCentavos / FREE_DELIVERY_THRESHOLD_IN_CENTAVOS) * 100)));
}
