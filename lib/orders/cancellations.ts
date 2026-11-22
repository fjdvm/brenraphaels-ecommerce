import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import { customers, failedDeliveries, orders, orderCancellations, stockReservations, stockOutbox } from "../db/schema";
import { textField } from "../validators/fields";
import { staffAttribution } from "../validators/staff";
import { fileIdField } from "../validators/file-id";
import { gatewayShopStock, StockUnavailableError, type ShopStock } from "./stock";
import type { AuditEvent } from "../audit/gateway";

export const cancellationRequestInput = z.object({ reason: textField("Reason", { min: 1, max: 1000, pattern: /^[^<>\p{Cc}]+$/u, patternMessage: "Enter plain text without markup or control characters", rejectInvisible: true }) }).strict();
export const cancellationSettlementInput = z.object({ action: z.literal("settle"), requestId: z.uuid(), stockOutcome: z.enum(["restock", "write-off"]),
  refundMethod: z.enum(["gcash", "maya", "bank-transfer"]).nullable(), refundProofFileId: fileIdField.nullable(), ...staffAttribution.shape }).strict();
export const staffCancellationRequestInput = cancellationRequestInput.extend({ action: z.literal("request"), ...staffAttribution.shape }).strict();
export class CancellationError extends Error {}

/** Only CREOMS's authenticated internal route may settle; Customers can only request their own Orders. */
export function createOrderCancellations<T extends PgQueryResultHKT, S extends Record<string, unknown>>(db: PgDatabase<T, S>, stock: ShopStock = gatewayShopStock()) {
  async function request(orderId: number, raw: unknown, actor: { type: "customer" | "staff"; id: string; name: string }) {
    const input = cancellationRequestInput.parse(raw);
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), actor.type === "customer" ? eq(orders.customerId, actor.id) : undefined)).for("update");
      if (!order || order.status !== "dispatched") throw new CancellationError("Only your dispatched Order can have a cancellation request.");
      const [existing] = await tx.select().from(orderCancellations).where(eq(orderCancellations.orderId, orderId));
      if (!existing && actor.type === "customer") throw new CancellationError("The shop has started preparing your order, so it can't be cancelled here.");
      if (existing) return { id: orderId, requestId: existing.id, status: existing.status === "waiting-manager" ? existing.approvalStatus : existing.status, declineReason: existing.declineReason };
      const id = randomUUID();
      await tx.insert(orderCancellations).values({ id, orderId, reason: input.reason, actorType: actor.type, actorId: actor.id, actorName: actor.name });
      const event: AuditEvent = { source: "Ecommerce", action: "order.cancel_requested", outcome: "success", actor: { type: actor.type, id: actor.id, display_name: actor.name }, target: { type: "order", id: String(orderId), display_name: `Order #${orderId}` }, description: `${actor.name} requested cancellation after dispatch.`, occurred_at: new Date().toISOString(), idempotency_key: `cancellation:${id}:requested` };
      await tx.insert(stockOutbox).values({ key: event.idempotency_key!, kind: "audit", payload: event }).onConflictDoNothing();
      return { id: orderId, requestId: id, status: "waiting-manager" };
    });
  }
  async function settle(orderId: number, raw: unknown) {
    const input = cancellationSettlementInput.parse(raw);
    // Persist the immutable intent BEFORE IMS. Partial restocks can never become a write-off on retry.
    await db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      const [record] = await tx.select().from(orderCancellations).where(and(eq(orderCancellations.id, input.requestId), eq(orderCancellations.orderId, orderId))).for("update");
      if (!record || !order || !["dispatched", "cancelled"].includes(order.status)) throw new CancellationError("Order or cancellation already changed. Refresh first.");
      const prepaid = ["gcash", "maya", "bank-transfer"].includes(order.paymentMethod);
      if (prepaid ? input.refundMethod !== order.paymentMethod || !input.refundProofFileId : input.refundMethod !== null || input.refundProofFileId !== null) throw new CancellationError("Refund must use the original prepaid method and proof. Cash on Delivery has no refund.");
      if (record.approvalStatus !== "approved") throw new CancellationError("A Manager must approve this cancellation first.");
      if (record.status !== "waiting-manager") {
        if (record.stockOutcome !== input.stockOutcome || record.refundMethod !== input.refundMethod || record.refundProofFileId !== input.refundProofFileId) throw new CancellationError("The cancellation settlement already started with different details.");
        return;
      }
      if (order.status !== "dispatched") throw new CancellationError("Order already changed.");
      const attempts = await tx.select().from(failedDeliveries).where(eq(failedDeliveries.orderId, orderId));
      if (attempts.some(a => a.disposition && a.disposition !== input.stockOutcome)) throw new CancellationError("Stock outcome must match the recorded failed-delivery decision.");
      await tx.update(orderCancellations).set({ status: "settling", stockOutcome: input.stockOutcome, refundMethod: input.refundMethod, refundProofFileId: input.refundProofFileId, settledById: input.staffId, settledByName: input.staffName }).where(eq(orderCancellations.id, record.id));
    });
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      const [record] = await tx.select().from(orderCancellations).where(eq(orderCancellations.id, input.requestId)).for("update");
      if (record.status !== "cancelled") {
        if (order.status !== "dispatched") throw new CancellationError("Order already changed.");
        const [reservation] = await tx.select().from(stockReservations).where(eq(stockReservations.orderId, orderId)).for("update");
        if (!reservation || !reservation.lines.length || reservation.lines.some(l => !l.deducted && !l.released)) throw new CancellationError("No packed IMS stock is available. Reconcile this Order first.");
        for (const line of reservation.lines) {
          if (!line.released && input.stockOutcome === "restock" && await stock.move("add_back", reservation.id, line) !== "added_back") throw new StockUnavailableError();
        }
        await tx.update(stockReservations).set({ lines: reservation.lines.map(l => ({ ...l, released: true })), state: "released" }).where(eq(stockReservations.id, reservation.id));
        const at = new Date();
        await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, orderId));
        await tx.update(orderCancellations).set({ status: "cancelled", settledAt: at }).where(eq(orderCancellations.id, record.id));
        const event: AuditEvent = { source: "Ecommerce", action: "order.cancelled_after_dispatch", outcome: "success", actor: { type: "staff", id: input.staffId, display_name: input.staffName }, target: { type: "order", id: String(orderId), display_name: `Order #${orderId}` }, description: `${input.staffName} cancelled after dispatch; stock: ${input.stockOutcome}; refund: ${input.refundMethod ?? "none (COD)"}.`, occurred_at: at.toISOString(), idempotency_key: `cancellation:${record.id}:cancelled` };
        await tx.insert(stockOutbox).values({ key: event.idempotency_key!, kind: "audit", payload: event }).onConflictDoNothing();
        const [customer] = await tx.select().from(customers).where(eq(customers.id, order.customerId));
        await tx.insert(stockOutbox).values({ key: `cancellation:${record.id}:email`, kind: "email", payload: { to: customer.email, title: `Order #${orderId} cancelled`, body: `Your Order was cancelled after dispatch. ${input.refundMethod ? `Your payment was refunded by ${input.refundMethod}.` : "Cash on Delivery: no payment was collected and no refund is due."}` } }).onConflictDoNothing();
      }
      return { id: orderId, requestId: record.id, status: "cancelled", stockOutcome: record.stockOutcome, refundMethod: record.refundMethod, refundProofFileId: record.refundProofFileId };
    });
  }
  async function decide(orderId: number, requestId: string, decision: "approved" | "declined", reason: string, staff: { id: string; name: string }) {
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      const [record] = await tx.select().from(orderCancellations).where(and(eq(orderCancellations.id, requestId), eq(orderCancellations.orderId, orderId))).for("update");
      if (!order || !record) throw new CancellationError("Cancellation request was not found.");
      if (record.approvalStatus !== "waiting-manager" && record.approvalStatus !== decision) throw new CancellationError("The cancellation decision already changed.");
      await tx.update(orderCancellations).set({ approvalStatus: decision, declineReason: decision === "declined" ? reason : null }).where(eq(orderCancellations.id, requestId));
      const [customer] = await tx.select().from(customers).where(eq(customers.id, order.customerId));
      await tx.insert(stockOutbox).values({ key: `cancellation:${requestId}:decision-email`, kind: "email", payload: {
        to: customer.email, title: `Order #${orderId}: cancellation request ${decision}`,
        body: decision === "declined" ? `${staff.name} declined your cancellation request: ${reason}. Your Order has not been cancelled.`
          : `${staff.name} approved your cancellation request. Staff will finish the stock and refund steps before your Order is cancelled.`,
      } }).onConflictDoNothing();
      return { id: orderId, requestId, status: decision };
    });
  }
  return { request, settle, decide };
}
