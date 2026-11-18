import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customerRefundDestinations, orderReturns, orders } from "../db/schema";
import { staffAttribution } from "../validators/staff";
import { refundDestinationInput } from "./refund-destination";

export class RefundDestinationError extends Error {}

/** CREOMS sends the same fields the Customer enters; `confirmed` here is the Customer telling the Manager the new details are right. */
export const changeRefundDestinationInput = z.object({
  method: z.string(), accountName: z.string(), accountNumber: z.string(), bankName: z.string().nullable().optional(),
  reason: z.string().trim().min(1, "Enter a reason for changing the destination.").max(500),
  customerConfirmed: z.literal(true, { error: "The Customer must confirm the new destination." }),
  ...staffAttribution.shape,
}).strict();

/**
 * A Manager's change to a locked Refund destination, decided in CREOMS. It only works on an approved refund that has not been
 * refunded yet, and it records the new details as the Customer's confirmed ones (so their next Return pre-fills them). Safe to repeat.
 */
export function changeRefundDestination<T extends PgQueryResultHKT, S extends Record<string, unknown>>(db: PgDatabase<T, S>, now: () => Date = () => new Date()) {
  return async function change(returnId: number, raw: unknown): Promise<{ returnId: number; changedAt: Date }> {
    const input = changeRefundDestinationInput.parse(raw);
    const destination = refundDestinationInput.parse({ method: input.method, accountName: input.accountName, accountNumber: input.accountNumber, bankName: input.bankName ?? undefined, confirmed: true });

    return db.transaction(async (tx) => {
      const [ret] = await tx.select().from(orderReturns).where(eq(orderReturns.id, returnId)).for("update");
      if (!ret) throw new RefundDestinationError("Return not found.");
      if (ret.finalResolution !== "refund" || !["approved", "goods received"].includes(ret.status)) {
        throw new RefundDestinationError("Money was already sent, or this is not an approved refund.");
      }
      const changedAt = now();
      await tx.update(orderReturns).set({ refundMethod: destination.method, refundAccountName: destination.accountName,
        refundAccountNumber: destination.accountNumber, refundBankName: destination.bankName, refundDestinationConfirmedAt: changedAt }).where(eq(orderReturns.id, returnId));
      const [order] = await tx.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, ret.orderId));
      if (order) {
        const values = { method: destination.method, accountName: destination.accountName, accountNumber: destination.accountNumber, bankName: destination.bankName, confirmedAt: changedAt };
        await tx.insert(customerRefundDestinations).values({ customerId: order.customerId, ...values }).onConflictDoUpdate({ target: customerRefundDestinations.customerId, set: values });
      }

      return { returnId, changedAt };
    });
  };
}
