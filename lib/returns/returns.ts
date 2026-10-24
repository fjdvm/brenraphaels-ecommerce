import { eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { orders, orderReturns, orderReturnHistory, returnResolutions } from "../db/schema";
import { multilineTextField } from "../validators/fields";
import { fileIdField } from "../validators/file-id";
import { staffAttribution } from "../validators/staff";

export type ReturnActor = { type: "staff" | "customer"; id: string; name: string };

const actorSchema = z.object({
  type: z.enum(["staff", "customer"]),
  id: staffAttribution.shape.staffId,
  name: staffAttribution.shape.staffName,
}).strict();
const decisionSchema = z.discriminatedUnion("status", [z.object({
  status: z.literal("approved"),
  finalResolution: z.enum(returnResolutions).optional(),
  goodsRequired: z.boolean().default(false),
}).strict(),
  z.object({ status: z.literal("goods received") }).strict(),
  z.object({ status: z.literal("refunded"), refundProofFileId: fileIdField }).strict(),
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
    const decision = decisionSchema.parse(input);
    return db.transaction(async (tx) => {
      // Serialize competing decisions before checking status or recording history.
      const [current] = await tx.select().from(orderReturns).where(eq(orderReturns.id, id)).for("update");
      if (!current) throw new ReturnTransitionError("Return not found.");
      const [order] = await tx.select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, current.orderId));
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
      const at = (deps.now ?? (() => new Date()))();
      const [updated] = await tx.update(orderReturns).set({ status: decision.status,
        ...(decision.status === "approved" ? {
          finalResolution: decision.finalResolution ?? current.preferredResolution, goodsRequired: decision.goodsRequired,
        } : {}),
        ...(decision.status === "refunded" ? { refundedAt: at, refundProofFileId: decision.refundProofFileId } : {}),
        ...(decision.status === "replaced" ? { replacedAt: at } : {}),
        ...(decision.status === "declined" ? { declineReason: decision.declineReason } : {}),
      }).where(eq(orderReturns.id, id)).returning();
      await tx.insert(orderReturnHistory).values({ returnId: id, status: updated.status, actorType: actor.type,
        actorId: actor.id, actorName: actor.name, occurredAt: at,
        note: decision.status === "declined" ? decision.declineReason : null });
      return { ...updated, number: formatReturnNumber(id), actedBy: { ...actor, at } };
    });
  }
  return { transition };
}
