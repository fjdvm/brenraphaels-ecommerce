/** Shown at checkout and on the Order while a free-delivery Order waits for Staff. */
export const FREE_DELIVERY_CONFIRMATION_NOTICE = "Your order is subject to shop confirmation";

/** Strictly over the threshold: a subtotal equal to it does not qualify. Amounts are centavos, after discounts. */
export function qualifiesForFreeDelivery(subtotalAfterDiscountsInCentavos: number, thresholdInCentavos: number | null): boolean {
  return thresholdInCentavos !== null && subtotalAfterDiscountsInCentavos > thresholdInCentavos;
}
