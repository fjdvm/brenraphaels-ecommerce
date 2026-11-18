/** Pure payment-deadline rules; no database, so client components may import them. */
export const DEFAULT_PAYMENT_WINDOW_HOURS = 24;

/** The deadline saved at confirmation; 24 hours after confirmation for an Order confirmed before it was saved. Null before confirmation. */
export function paymentDeadlineOf(order: { confirmedAt?: Date | null; paymentDeadlineAt?: Date | null }): Date | null {
  if (order.paymentDeadlineAt) return order.paymentDeadlineAt;
  return order.confirmedAt ? new Date(order.confirmedAt.getTime() + DEFAULT_PAYMENT_WINDOW_HOURS * 3_600_000) : null;
}

export function paymentDeadlinePassed(order: { confirmedAt?: Date | null; paymentDeadlineAt?: Date | null }, now: Date): boolean {
  const deadline = paymentDeadlineOf(order);
  return deadline !== null && deadline.getTime() <= now.getTime();
}
