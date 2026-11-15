import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { customers, customerNotifications, orders, stockOutbox, stockReservations } from "../db/schema";
import { writeAuditEvent, type AuditEvent, type AuditIdentity } from "../audit/gateway";
import { sendAppEmail, type AppEmail } from "../notifications/gateway";
import { required } from "../gateway";
import type { Cart } from "./cart";
import { gatewayShopStock, StockRefusedError, StockUnavailableError, type ShopStock } from "./stock";

type Reservation = typeof stockReservations.$inferSelect;
const unpaidStatuses = ["placed", "confirmed", "awaiting payment"];
const prepaidMethods = ["gcash", "maya", "bank-transfer"];
const day = 24 * 60 * 60 * 1000;

export function createStockReservations<T extends PgQueryResultHKT, S extends Record<string, unknown>>(
  db: PgDatabase<T, S>, stock: ShopStock = gatewayShopStock(),
) {
  async function begin(customerId: string, cart: Cart) {
    if (!cart.lines.length) throw new Error("Your Cart is empty.");
    const lines = cart.lines.map(line => ({
      lineId: `size-${line.sizeId}`, productId: stock.productForSize(line.sizeId), quantity: line.quantity,
      sizeId: line.sizeId, cartLineId: line.id, priceInCentavos: line.priceInCentavos,
    }));
    const [customer] = await db.select().from(customers).where(eq(customers.id, customerId));
    const [reservation] = await db.insert(stockReservations).values({ id: randomUUID(), customerId, customerName: customer.fullName, state: "pending", lines }).returning();
    return reservation.id;
  }

  /** Called inside the Order transaction; the lock fences recovery and concurrent checkout. */
  async function reserve(id: string, cart: Cart) {
    const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.id, id)).for("update");
    if (!reservation || reservation.state !== "pending") throw new StockUnavailableError();
    if (reservation.lines.length !== cart.lines.length || reservation.lines.some(line => !cart.lines.some(item =>
      item.id === line.cartLineId && item.sizeId === line.sizeId && item.quantity === line.quantity && item.priceInCentavos === line.priceInCentavos))) {
      throw new Error("Your Cart changed. Review it before trying again.");
    }
    for (const line of reservation.lines) {
      if (await stock.move("reserve", id, line) !== "reserved") throw new StockUnavailableError();
    }
  }

  async function queueAudit(reservation: Reservation, action: "order.stock_reserved" | "order.stock_released", line: Reservation["lines"][number]) {
    const key = `${action}:${reservation.id}:${line.lineId}`;
    const event: AuditEvent = {
      source: "Ecommerce", action, outcome: "success",
      actor: action === "order.stock_released" && line.releaseActor ? line.releaseActor : { type: "customer", id: reservation.customerId, display_name: reservation.customerName },
      target: { type: "order", id: String(reservation.orderId ?? reservation.id), display_name: reservation.orderId === null ? "Unplaced checkout" : `Order #${reservation.orderId}` },
      description: `${action === "order.stock_reserved" ? "Reserved" : "Released"} ${line.quantity} of IMS Size ${line.productId}.`,
      occurred_at: new Date().toISOString(), idempotency_key: key,
    };
    await db.insert(stockOutbox).values({ key, kind: "audit", payload: event }).onConflictDoNothing();
  }

  async function commit(id: string, orderId: number, orderLineIds: number[]) {
    const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.id, id));
    const lines = reservation.lines.map((line, index) => ({ ...line, orderLineId: orderLineIds[index] }));
    await db.update(stockReservations).set({ state: "placed", orderId, lines }).where(eq(stockReservations.id, id));
    for (const line of lines) await queueAudit({ ...reservation, orderId }, "order.stock_reserved", line);
  }

  /** Immutable IMS keys make retries after partial deduction or a lost reply safe. */
  async function deduct(orderId: number) {
    const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.orderId, orderId)).for("update");
    if (!reservation) return; // Legacy Orders were never reserved in IMS.
    if (reservation.state !== "placed") throw new StockUnavailableError();
    const lines = reservation.lines.map(line => ({ ...line }));
    for (const line of lines) {
      if (line.release || line.released) continue;
      if (await stock.move("deduct", reservation.id, line) !== "deducted") throw new StockUnavailableError();
      line.deducted = true;
    }
    await db.update(stockReservations).set({ lines }).where(eq(stockReservations.id, reservation.id));
  }

  async function releaseItems(orderId: number, lineIds?: number[], actor?: AuditIdentity) {
    const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.orderId, orderId)).for("update");
    if (!reservation) return; // Legacy Orders never reserved in IMS.
    await db.update(stockReservations).set({ lines: reservation.lines.map(line =>
      (lineIds === undefined || (line.orderLineId !== undefined && lineIds.includes(line.orderLineId))) && !line.released ? { ...line, release: true, ...(actor ? { releaseActor: actor } : {}) } : line),
    }).where(eq(stockReservations.id, reservation.id));
    return reservation.id;
  }

  async function abandon(id: string) {
    await db.update(stockReservations).set({ state: "releasing" })
      .where(and(eq(stockReservations.id, id), eq(stockReservations.state, "pending")));
  }

  /** Recover abandoned checkouts and release cancelled Orders/items; never reopens an Order. */
  async function drain(now = new Date(), id?: string) {
    const candidates = await db.select({ id: stockReservations.id }).from(stockReservations).where(and(
      id === undefined ? undefined : eq(stockReservations.id, id),
      or(eq(stockReservations.state, "releasing"),
        and(eq(stockReservations.state, "pending"), lte(stockReservations.createdAt, new Date(now.getTime() - 10 * 60_000))),
        and(eq(stockReservations.state, "placed"), or(
          sql`exists (select 1 from ${orders} where ${orders.id} = ${stockReservations.orderId} and ${orders.status} = 'cancelled')`,
          sql`exists (select 1 from jsonb_array_elements(${stockReservations.lines}) line where line->>'release' = 'true' and coalesce(line->>'released', 'false') <> 'true')`,
        )),
      ),
    )).orderBy(sql`${stockReservations.lastAttemptAt} asc nulls first`, stockReservations.createdAt).limit(20);
    let released = 0;
    const deadline = Date.now() + 45_000;
    for (const candidate of candidates) {
      if (Date.now() >= deadline) break;
      try {
        await db.transaction(async tx => {
          const [reservation] = await tx.select().from(stockReservations).where(eq(stockReservations.id, candidate.id)).for("update", { skipLocked: true });
          if (!reservation || reservation.state === "released") return;
          const [order] = reservation.orderId === null ? [] : await tx.select().from(orders).where(eq(orders.id, reservation.orderId));
          const abandoned = reservation.state === "pending" || reservation.state === "releasing";
          if (reservation.state === "pending" && reservation.createdAt.getTime() > now.getTime() - 10 * 60_000) return;
          const all = abandoned || order?.status === "cancelled";
          const lines = reservation.lines.map(line => ({ ...line }));
          for (const line of lines) {
            if (Date.now() >= deadline) break;
            if (line.released || (!all && !line.release)) continue;
            if (abandoned) {
              // A lost reply may mean reserve succeeded. Reconcile with the SAME key before release.
              try {
                const state = await stock.move("reserve", reservation.id, line);
                if (state === "released") {
                  line.released = true;
                  await createStockReservations(tx, stock).queueAudit(reservation, "order.stock_released", line);
                  continue;
                }
                if (state !== "reserved") throw new StockUnavailableError();
              } catch (error) {
                if (!(error instanceof StockRefusedError)) throw error;
                line.released = true; continue; // IMS definitively has no Reservation for this immutable key.
              }
            }
            const state = await stock.move(line.deducted ? "add_back" : "release", reservation.id, line);
            if (state !== "released" && state !== "added_back") throw new StockUnavailableError();
            line.released = true;
            await createStockReservations(tx, stock).queueAudit(reservation, "order.stock_released", line);
          }
          await tx.update(stockReservations).set({ lines, lastAttemptAt: new Date(), state: lines.every(line => line.released) ? "released" : reservation.state })
            .where(eq(stockReservations.id, reservation.id));
        });
        released++;
      } catch (error) {
        await db.update(stockReservations).set({ lastAttemptAt: new Date() }).where(eq(stockReservations.id, candidate.id));
        console.error("Stock release will be retried", error);
      }
    }
    return released;
  }

  /** The Order row lock serializes expiry with payment and Staff decisions. */
  async function expire(now = new Date(), publish?: (customerId: string, orderId: number) => Promise<void>) {
    const due = await db.select({ id: orders.id }).from(orders).where(and(
      inArray(orders.paymentMethod, prepaidMethods), inArray(orders.status, unpaidStatuses),
      lte(orders.createdAt, new Date(now.getTime() - day)),
    )).orderBy(orders.createdAt).limit(50);
    let cancelled = 0;
    for (const candidate of due) {
      let changed: { customerId: string; orderId: number } | undefined;
      await db.transaction(async tx => {
        const [order] = await tx.select().from(orders).where(and(eq(orders.id, candidate.id),
          inArray(orders.paymentMethod, prepaidMethods), inArray(orders.status, unpaidStatuses),
          lte(orders.createdAt, new Date(now.getTime() - day)),
        )).for("update", { skipLocked: true });
        if (!order) return;
        await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, order.id));
        await createStockReservations(tx, stock).releaseItems(order.id, undefined, { type: "system", id: "unpaid-order-expiry", display_name: "Unpaid Order expiry" });
        const key = `order.unpaid-cancelled:${order.id}`;
        const [customer] = await tx.select().from(customers).where(eq(customers.id, order.customerId));
        await tx.insert(stockOutbox).values({ key, kind: "email", orderId: order.id, payload: {
          to: customer.email, title: "Your order was cancelled",
          body: `Order #${order.id} was cancelled because payment was not confirmed within 24 hours. Its reserved items will be released. You can place a new Order.`,
          button: { label: "View Order", link: `${required("NEXT_PUBLIC_SITE_URL").replace(/\/$/, "")}/profile/orders?order=${order.id}` },
        } }).onConflictDoNothing();
        await tx.insert(customerNotifications).values({ idempotencyKey: `order.cancelled:${order.id}`, orderId: order.id,
          customerId: order.customerId, type: "order.cancelled", title: "Your order was cancelled",
          body: "Payment was not confirmed within 24 hours. You can place a new Order.", link: `/profile/orders?order=${order.id}`,
        }).onConflictDoNothing();
        changed = { customerId: order.customerId, orderId: order.id };
        cancelled++;
      });
      if (changed && publish) {
        try { await publish(changed.customerId, changed.orderId); } catch (error) { console.error("Order expiry live event could not be published", error); }
      }
    }
    return cancelled;
  }

  async function sendPending(dependencies = { audit: writeAuditEvent, email: sendAppEmail }) {
    // Independent service queues: a refused audit catalog must never block Customer email.
    for (const kind of ["email", "audit"] as const) {
    const deadline = Date.now() + 25_000;
    const pending = await db.select().from(stockOutbox).where(and(isNull(stockOutbox.acceptedAt), eq(stockOutbox.kind, kind)))
      .orderBy(sql`${stockOutbox.lastAttemptAt} asc nulls first`, stockOutbox.key).limit(25);
    for (const item of pending) {
      if (Date.now() >= deadline) break;
      await db.update(stockOutbox).set({ lastAttemptAt: new Date() }).where(eq(stockOutbox.key, item.key));
      try {
        if (item.kind === "email" && item.orderId !== null) {
          const [reservation] = await db.select().from(stockReservations).where(eq(stockReservations.orderId, item.orderId));
          if (reservation && reservation.state !== "released") continue;
        }
        if (item.kind === "audit") await dependencies.audit(item.payload as AuditEvent);
        else await dependencies.email({ ...item.payload as AppEmail, idempotencyKey: item.key });
        await db.update(stockOutbox).set({ acceptedAt: new Date() }).where(eq(stockOutbox.key, item.key));
      } catch (error) { console.error("Stock event will be retried", error); }
    }
    }
  }
  return { begin, reserve, commit, deduct, releaseItems, abandon, drain, expire, sendPending, queueAudit };
}
