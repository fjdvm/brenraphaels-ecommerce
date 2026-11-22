import { and, eq } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { z } from "zod";

import { customers, orderReturnItems, orderReturns, orders, stockOutbox, stockReservations } from "../db/schema";
import { gatewayShopStock, StockUnavailableError, type ShopStock } from "../orders/stock";
import { staffAttribution } from "../validators/staff";

const inspectInput = z.object({
  action: z.literal("inspect"),
  inspectionId: z.uuid(),
  items: z.array(z.object({ orderLineId: z.number().int().positive(), condition: z.enum(["sellable", "damaged"]) }).strict()).min(1).max(100),
  ...staffAttribution.shape,
}).strict();
const writeOffInput = z.object({ action: z.literal("write-off"), inspectionId: z.uuid(), ...staffAttribution.shape }).strict();
export const returnInspectionInput = z.discriminatedUnion("action", [inspectInput, writeOffInput]);

export class InspectionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) { super(message); }
}

export type InspectionResult = { id: number; inspectionId: string; action: "inspect" | "write-off" };

/**
 * Staff inspect each whole line item of a Return after Goods received (CREOMS decides who may ask). Sellable items go back
 * to IMS stock through the original Order's Reservation; damaged items wait for a Manager-approved write-off, which never
 * adds them back. The inspection id makes every step safe to repeat: a retry resumes, never moves stock twice.
 */
export function createReturnInspections<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, stock: ShopStock = gatewayShopStock(),
) {
  async function inspect(returnId: number, input: z.infer<typeof inspectInput>): Promise<InspectionResult> {
    // Persist the immutable decision BEFORE IMS, so a partial restock can only resume the same decision.
    const orderId = await db.transaction(async tx => {
      const [ret] = await tx.select().from(orderReturns).where(eq(orderReturns.id, returnId)).for("update");
      if (!ret) throw new InspectionError("Return was not found.", 404);
      const items = await tx.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, returnId));
      if (items.length && items.every(item => item.inspectionId === input.inspectionId)) return ret.orderId;
      if (ret.status !== "goods received" || items.some(item => item.condition)) throw new InspectionError("Return is not ready to inspect or was already inspected.");
      const given = new Map(input.items.map(item => [item.orderLineId, item.condition]));
      if (!items.length || given.size !== input.items.length || given.size !== items.length || !items.every(item => given.has(item.orderLineId))) {
        throw new InspectionError("Mark every item sellable or damaged.", 400);
      }
      const at = new Date();
      for (const item of items) {
        await tx.update(orderReturnItems).set({
          condition: given.get(item.orderLineId), inspectedAt: at, inspectedById: input.staffId, inspectedByName: input.staffName, inspectionId: input.inspectionId,
        }).where(and(eq(orderReturnItems.returnId, returnId), eq(orderReturnItems.orderLineId, item.orderLineId)));
      }
      return ret.orderId;
    });

    const pending = (await db.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, returnId)))
      .filter(item => item.condition === "sellable" && !item.restockedAt);
    for (const item of pending) {
      await db.transaction(async tx => {
        const [reservation] = await tx.select().from(stockReservations).where(eq(stockReservations.orderId, orderId)).for("update");
        const line = reservation?.lines.find(candidate => candidate.orderLineId === item.orderLineId);
        if (!reservation || !line || !line.deducted) throw new InspectionError(`${item.productName} has no packed IMS stock to add back. Ask IMS Staff to reconcile this Order's stock first.`);
        if (line.released) throw new InspectionError(`${item.productName} was already returned to or written off from IMS stock.`);
        if (await stock.move("add_back", reservation.id, line) !== "added_back") throw new StockUnavailableError();
        await tx.update(stockReservations).set({ lines: reservation.lines.map(candidate => candidate === line ? { ...candidate, released: true } : candidate) })
          .where(eq(stockReservations.id, reservation.id));
        await tx.update(orderReturnItems).set({ restockedAt: new Date() })
          .where(and(eq(orderReturnItems.returnId, returnId), eq(orderReturnItems.orderLineId, item.orderLineId)));
      });
    }
    return { id: returnId, inspectionId: input.inspectionId, action: "inspect" };
  }

  async function writeOff(returnId: number, input: z.infer<typeof writeOffInput>): Promise<InspectionResult> {
    return db.transaction(async tx => {
      const [ret] = await tx.select().from(orderReturns).where(eq(orderReturns.id, returnId)).for("update");
      if (!ret) throw new InspectionError("Return was not found.", 404);
      const items = await tx.select().from(orderReturnItems).where(eq(orderReturnItems.returnId, returnId));
      const damaged = items.filter(item => item.condition === "damaged");
      const done: InspectionResult = { id: returnId, inspectionId: input.inspectionId, action: "write-off" };
      if (!damaged.length || damaged.some(item => item.inspectionId !== input.inspectionId)) throw new InspectionError("Nothing to write off on this Return.");
      if (damaged.every(item => item.writtenOffAt)) return done;
      const at = new Date();
      for (const item of damaged) {
        await tx.update(orderReturnItems).set({ writtenOffAt: at })
          .where(and(eq(orderReturnItems.returnId, returnId), eq(orderReturnItems.orderLineId, item.orderLineId)));
      }
      // Written-off goods must never be added back to IMS stock later.
      const [reservation] = await tx.select().from(stockReservations).where(eq(stockReservations.orderId, ret.orderId)).for("update");
      if (reservation) {
        const lineIds = new Set(damaged.map(item => item.orderLineId));
        await tx.update(stockReservations).set({ lines: reservation.lines.map(line => line.orderLineId !== undefined && lineIds.has(line.orderLineId) ? { ...line, released: true } : line) })
          .where(eq(stockReservations.id, reservation.id));
      }
      const [owner] = await tx.select({ email: customers.email }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(eq(orders.id, ret.orderId));
      if (owner) {
        await tx.insert(stockOutbox).values({ key: `return.written_off:${returnId}:email`, kind: "email", payload: {
          to: owner.email, title: `We checked the items from Return RMA-${returnId}`,
          body: `We inspected what came back for Return RMA-${returnId} (Order #${ret.orderId}). ${damaged.map(item => item.productName).join(", ")} arrived damaged and won't be resold. Your Return continues as agreed.`,
        } }).onConflictDoNothing();
      }
      return done;
    });
  }

  return {
    async handle(returnId: number, raw: unknown): Promise<InspectionResult> {
      const input = returnInspectionInput.parse(raw);
      return input.action === "inspect" ? inspect(returnId, input) : writeOff(returnId, input);
    },
  };
}
