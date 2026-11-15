import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";
import { customers, orderCancellations, failedDeliveries, orders, stockOutbox, stockReservations } from "../db/schema";
import { staffAttribution } from "../validators/staff";
import { textField } from "../validators/fields";
import { courierBooking } from "../validators/courier";
import { gatewayShopStock, StockUnavailableError, type ShopStock } from "./stock";
import type { AuditEvent } from "../audit/gateway";

const reasonField = (label: string) => textField(label, { min: 1, max: 1000, pattern: /^[^<>\p{Cc}]+$/u, patternMessage: "Enter plain text without markup or control characters", rejectInvisible: true });
export const failedDeliveryInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("record"), attemptId: z.uuid(), reason: reasonField("Reason"), nextStep: z.enum(["rebook", "request-cancellation"]), customerMessage: reasonField("Customer message"), ...staffAttribution.shape }).strict(),
  z.object({ action: z.literal("rebook"), attemptId: z.uuid(), courier: courierBooking, ...staffAttribution.shape }).strict(),
  z.object({ action: z.enum(["restock", "write-off"]), attemptId: z.uuid(), ...staffAttribution.shape }).strict(),
]);
export class FailedDeliveryError extends Error {}

/** The authenticated CREOMS boundary decides Roles/approvals; the storefront owns history and IMS references. */
export function createFailedDeliveries<T extends PgQueryResultHKT, S extends Record<string, unknown>>(db: PgDatabase<T, S>, stock: ShopStock = gatewayShopStock()) {
  async function change(orderId: number, raw: unknown) {
    const input = failedDeliveryInput.parse(raw);
    // Commit the disposition intent BEFORE crossing IMS. A partial restock can only resume restock.
    if (input.action === "restock" || input.action === "write-off") {
      await db.transaction(async tx => {
        const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
        if (!order || order.status !== "dispatched") throw new FailedDeliveryError("Only a dispatched Order can be inspected.");
        const [cancellation] = await tx.select().from(orderCancellations).where(eq(orderCancellations.orderId, orderId));
        if (cancellation?.status === "settling") throw new FailedDeliveryError("Cancellation settlement has started.");
        const [attempt] = await tx.select().from(failedDeliveries).where(and(eq(failedDeliveries.id, input.attemptId), eq(failedDeliveries.orderId, orderId))).for("update");
        if (!attempt || attempt.rebookedAt || attempt.disposition && attempt.disposition !== input.action) throw new FailedDeliveryError("The failed attempt already changed. Refresh the Order.");
        await tx.update(failedDeliveries).set({ disposition: input.action }).where(eq(failedDeliveries.id, attempt.id));
      });
    }
    return db.transaction(async tx => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
      if (!order || order.status !== "dispatched" || order.fulfillmentMethod !== "delivery") throw new FailedDeliveryError("Only a dispatched Delivery Order can have a failed delivery.");
      const [cancellation] = await tx.select().from(orderCancellations).where(eq(orderCancellations.orderId, orderId));
      if (cancellation?.status === "settling") throw new FailedDeliveryError("Cancellation settlement has started. Refresh the Order.");
      const attempts = await tx.select().from(failedDeliveries).where(eq(failedDeliveries.orderId, orderId)).orderBy(failedDeliveries.createdAt);
      const existing = attempts.find(attempt => attempt.id === input.attemptId);
      const latest = attempts.at(-1);
      async function audit(action: string) {
        const key = `${action}:${input.attemptId}`;
        const event: AuditEvent = { source: "Ecommerce", action, outcome: "success", actor: { type: "staff", id: input.staffId, display_name: input.staffName }, target: { type: "order", id: String(orderId), display_name: `Order #${orderId}` }, description: `${input.staffName}: ${action}`, occurred_at: new Date().toISOString(), idempotency_key: key };
        await tx.insert(stockOutbox).values({ key, kind: "audit", payload: event }).onConflictDoNothing();
      }
      async function email(action: string, body: string) {
        const [customer] = await tx.select().from(customers).where(eq(customers.id, order.customerId));
        await tx.insert(stockOutbox).values({ key: `${action}:${input.attemptId}:email`, kind: "email", payload: {
          to: customer.email, title: `Order #${orderId}: delivery update`, body,
        } }).onConflictDoNothing();
      }
      if (input.action === "record") {
        if (existing) {
          if (existing.reason !== input.reason || existing.nextStep !== input.nextStep || existing.customerMessage !== input.customerMessage || existing.staffId !== input.staffId) throw new FailedDeliveryError("That attempt reference was already used.");
        } else {
          if (latest && !latest.rebookedAt) throw new FailedDeliveryError("Handle the previous failed attempt before recording another.");
          await tx.insert(failedDeliveries).values({ id: input.attemptId, orderId, reason: input.reason, nextStep: input.nextStep, customerMessage: input.customerMessage, staffId: input.staffId, staffName: input.staffName });
          await audit("delivery.failed");
          await email("delivery.failed", `${input.reason}\n\n${input.customerMessage}`);
        }
      } else {
        if (!existing || latest?.id !== existing.id) throw new FailedDeliveryError("Failed attempt was not found or is no longer current.");
        if (input.action === "rebook") {
          if (existing.disposition || existing.nextStep !== "rebook") throw new FailedDeliveryError("Goods returned to stock or written off cannot be rebooked.");
          if (existing.rebookedAt && (Object.keys(courierBooking.shape) as (keyof typeof input.courier)[]).some(key => (existing.courier?.[key] ?? "") !== (input.courier[key] ?? ""))) throw new FailedDeliveryError("This attempt was already rebooked.");
          if (!existing.rebookedAt) {
            await tx.update(orders).set({ courier: input.courier.name, courierTrackingUrl: input.courier.trackingUrl, riderName: input.courier.riderName ?? null, riderPlate: input.courier.riderPlate ?? null, riderPhone: input.courier.riderPhone ?? null }).where(eq(orders.id, orderId));
            await tx.update(failedDeliveries).set({ rebookedAt: new Date(), courier: input.courier }).where(eq(failedDeliveries.id, existing.id));
            await audit("delivery.rebooked");
            await email("delivery.rebooked", `Staff rebooked your delivery with ${input.courier.name}. Track your delivery: ${input.courier.trackingUrl}`);
          }
        } else if (!existing.disposedAt) {
          const [reservation] = await tx.select().from(stockReservations).where(eq(stockReservations.orderId, orderId)).for("update");
          if (!reservation || !reservation.lines.some(line => line.deducted && !line.released)) throw new FailedDeliveryError("No packed IMS stock is available for this Order. Reconcile its stock first.");
          for (const line of reservation.lines) {
            if (!line.deducted || line.released) continue;
            if (input.action === "restock" && await stock.move("add_back", reservation.id, line) !== "added_back") throw new StockUnavailableError();
          }
          // Packed goods were already deducted. A write-off records the loss; it must never add them back on cancellation.
          await tx.update(stockReservations).set({ lines: reservation.lines.map(line => line.deducted ? { ...line, released: true } : line) }).where(eq(stockReservations.id, reservation.id));
          await tx.update(failedDeliveries).set({ disposedAt: new Date() }).where(eq(failedDeliveries.id, existing.id));
          await audit(input.action === "restock" ? "delivery.restocked" : "writeoff.approved");
          await email(`delivery.${input.action}`, input.action === "restock"
            ? "Staff returned the goods to stock. This booking will not be sent again. Staff will arrange the next step with a Manager."
            : "The returned goods were approved for write-off. This booking will not be sent again. Staff will arrange the next step with a Manager.");
        }
      }
      return { id: orderId, status: "dispatched", attemptId: input.attemptId, action: input.action };
    });
  }
  return { change };
}
