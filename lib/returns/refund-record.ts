// Mirrors CREOMS features/returns/refund-record.ts (epic-crms#613). CREOMS checks first so Staff get the reason early;
// the storefront enforces the same rules when it commits the refund, so a refund never exists without its details.

export const refundPaidMethods = ["gcash", "maya", "bank-transfer"] as const;
export type RefundPaidMethod = (typeof refundPaidMethods)[number];

const manila = (at: Date) => new Date(at.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * What Staff recorded must match what is being refunded: the amount is items plus any Delivery fee (never typed freely), the method
 * is the one the Customer confirmed (when one is on file), and the date is real, not in the future and not before the request.
 */
export function checkRefundRecord(input: {
  amountInCentavos: number;
  method: RefundPaidMethod;
  refundedOn: string;
  expectedInCentavos: number;
  destinationMethod: string | null;
  requestedAt: Date;
  now: Date;
}): { ok: true } | { ok: false; error: string } {
  if (input.amountInCentavos !== input.expectedInCentavos) {
    return { ok: false, error: "The amount sent must match the refund amount." };
  }
  if (input.destinationMethod && input.destinationMethod !== input.method) {
    return { ok: false, error: "The refund must be sent by the method the Customer confirmed." };
  }
  const valid = new Date(`${input.refundedOn}T00:00:00Z`);
  if (Number.isNaN(valid.getTime()) || valid.toISOString().slice(0, 10) !== input.refundedOn) {
    return { ok: false, error: "Enter the date the refund was sent." };
  }
  if (input.refundedOn > manila(input.now)) return { ok: false, error: "The refund date cannot be in the future." };
  if (input.refundedOn < manila(input.requestedAt)) return { ok: false, error: "The refund date cannot be before the Return was requested." };
  return { ok: true };
}
