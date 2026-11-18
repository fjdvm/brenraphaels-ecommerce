/** The details Staff record with a refund (epic-crms#613), for tests that only need a valid set. */
export function refundDetails(amountInCentavos: number, refundedOn: string) {
  return { refundAmountInCentavos: amountInCentavos, refundPaidMethod: "gcash" as const, refundedOn, refundReference: "GC-2026-0001" };
}
export const manilaToday = (now = new Date()) => new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
