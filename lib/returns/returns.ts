import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customerNotifications, orders, orderReturns, orderReturnHistory, orderReturnItems, returnResolutions } from "../db/schema";
import { returnNoticeContent } from "./return-notices";
import { checkRefund } from "./refund-rules";
import { checkRefundRecord, refundPaidMethods } from "./refund-record";
import { multilineTextField } from "../validators/fields";
import { fileIdField } from "../validators/file-id";
import { staffAttribution } from "../validators/staff";

export type ReturnActor = { type: "staff" | "customer"; id: string; name: string };

const actorSchema = z.object({
  type: z.enum(["staff", "customer"]),
  id: staffAttribution.shape.staffId,
  name: staffAttribution.shape.staffName,
}).strict();
export const returnDecisionSchema = z.discriminatedUnion("status", [z.object({
  status: z.literal("approved"),
  finalResolution: z.enum(returnResolutions).optional(),
  goodsRequired: z.boolean().default(false),
}).strict(),
  z.object({ status: z.literal("goods received") }).strict(),
  z.object({
    status: z.literal("refunded"), refundProofFileId: fileIdField,
    /** A Manager's reason for also refunding the Delivery fee; absent means items only. The amount is always the Order's own fee. */
    deliveryFeeReason: z.string().trim().min(1).max(500).optional(),
    /** What Staff recorded (epic-crms#613): all four are required, so a refund never exists without them. */
    refundAmountInCentavos: z.number().int().min(0).max(2_000_000_000),
    refundPaidMethod: z.enum(refundPaidMethods),
    refundedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the date the refund was sent."),
    refundReference: z.string().trim().min(4, "Enter the transfer reference, 4 to 100 characters.").max(100, "Enter the transfer reference, 4 to 100 characters.")
      .regex(/^[^\u0000-\u001f\u007f<>]*$/u, "Enter the transfer reference, 4 to 100 characters."),
  }).strict(),
  z.object({ status: z.literal("replaced") }).strict(),
  z.object({ status: z.literal("declined"), declineReason: multilineTextField("Decline reason", {
    max: 2000, pattern: /^[^<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/u,
    patternMessage: "Decline reason cannot contain angle brackets or control characters",
  }) }).strict(),
  z.object({ status: z.literal("cancelled") }).strict(),
]);

export class ReturnTransitionError extends Error {}

export function formatReturnNumber(id: number) {
  return `RMA-${id}`;
}

/** Internal persistence boundary. Callers authenticate Staff or resolve the Customer session first. */
export function createReturnStore<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(db: PgDatabase<TQueryResult, TSchema>, deps: { now?: () => Date } = {}) {
  async function transition(id: number, actorInput: ReturnActor, input: unknown) {
    const actor = actorSchema.parse(actorInput);
    const decision = returnDecisionSchema.parse(input);
    return db.transaction(async (tx) => {
      // Serialize competing decisions before checking status or recording history.
      const [current] = await tx.select().from(orderReturns).where(eq(orderReturns.id, id)).for("update");
      if (!current) throw new ReturnTransitionError("Return not found.");
      const [order] = await tx.select().from(orders).where(eq(orders.id, current.orderId)).for("update");
      if (actor.type === "customer" && actor.id !== order.customerId) throw new ReturnTransitionError("Return not found.");
      const allowed = (actor.type === "customer" && decision.status === "cancelled" && current.status === "requested") || (actor.type === "staff" && (
        ((decision.status === "approved" || decision.status === "declined") && current.status === "requested") ||
        (decision.status === "goods received" && current.status === "approved" && current.goodsRequired === true) ||
        ((decision.status === "refunded" || decision.status === "replaced") &&
          ((current.status === "approved" && current.goodsRequired === false) || current.status === "goods received") &&
          current.finalResolution === (decision.status === "refunded" ? "refund" : "replacement"))
      ));
      if (!allowed) {
        throw new ReturnTransitionError("Return already changed or this move is not allowed.");
      }
      let deliveryFee = 0;
      if (decision.status === "refunded") {
        const others = await tx.select({ amount: orderReturns.amountInCentavos, fee: orderReturns.refundDeliveryFeeInCentavos })
          .from(orderReturns).where(and(eq(orderReturns.orderId, current.orderId), ne(orderReturns.id, id), inArray(orderReturns.status, ["refunded"])));
        const checked = checkRefund({ order, reason: current.reason, itemsInCentavos: current.amountInCentavos,
          prior: others.map((other) => ({ itemsInCentavos: other.amount, deliveryFeeInCentavos: other.fee ?? 0 })),
          deliveryFeeReason: decision.deliveryFeeReason });
        if (!checked.ok) throw new ReturnTransitionError(checked.error);
        deliveryFee = checked.deliveryFeeInCentavos;
      }
      const at = (deps.now ?? (() => new Date()))();
      if (decision.status === "refunded") {
        // Items only, as CREOMS reads it: a Return recorded before the items-only rule may carry the Delivery fee inside its amount.
        const [lines] = await tx.select({ gross: sql<string>`coalesce(sum(${orderReturnItems.quantity}::bigint * ${orderReturnItems.priceInCentavos}), 0)::text` })
          .from(orderReturnItems).where(eq(orderReturnItems.returnId, id));
        const items = Number(lines.gross) > 0 ? Math.min(current.amountInCentavos, Number(lines.gross)) : current.amountInCentavos;
        const recorded = checkRefundRecord({ amountInCentavos: decision.refundAmountInCentavos, method: decision.refundPaidMethod, refundedOn: decision.refundedOn,
          expectedInCentavos: items + deliveryFee, destinationMethod: current.refundMethod, requestedAt: current.requestedAt, now: at });
        if (!recorded.ok) throw new ReturnTransitionError(recorded.error);
      }
      const [updated] = await tx.update(orderReturns).set({ status: decision.status,
        ...(decision.status === "approved" ? {
          finalResolution: decision.finalResolution ?? current.preferredResolution, goodsRequired: decision.goodsRequired,
        } : {}),
        ...(decision.status === "refunded" ? { refundedAt: at, refundProofFileId: decision.refundProofFileId,
          refundAmountInCentavos: decision.refundAmountInCentavos, refundPaidMethod: decision.refundPaidMethod, refundPaidOn: decision.refundedOn, refundReference: decision.refundReference,
          ...(deliveryFee > 0 ? { refundDeliveryFeeInCentavos: deliveryFee, refundDeliveryFeeReason: decision.deliveryFeeReason } : {}) } : {}),
        ...(decision.status === "replaced" ? { replacedAt: at } : {}),
        ...(decision.status === "declined" ? { declineReason: decision.declineReason } : {}),
      }).where(eq(orderReturns.id, id)).returning();
      await tx.insert(orderReturnHistory).values({ returnId: id, status: updated.status, actorType: actor.type,
        actorId: actor.id, actorName: actor.name, occurredAt: at,
        note: decision.status === "declined" ? decision.declineReason : null });
      const content = returnNoticeContent(updated, "");
      if (content) await tx.insert(customerNotifications).values({
        idempotencyKey: `return.${updated.status.replace(" ", "-")}:${id}`,
        orderId: updated.orderId, customerId: order.customerId,
        type: `return.${updated.status.replace(" ", "-")}`,
        title: content.title, body: content.body, link: content.button.link,
      }).onConflictDoNothing();
      return { ...updated, number: formatReturnNumber(id), customerId: order.customerId, actedBy: { ...actor, at } };
    });
  }
  return { transition };
}
