import { and, asc, eq, inArray } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import { orderReturns, orders, tickets } from "../db/schema";

/** Order statuses from placed up to and including dispatched. */
export const inFlightOrderStatuses = ["placed", "confirmed", "awaiting payment", "paid", "preparing", "dispatched"];
export const inFlightReturnStatuses = ["requested", "approved"];
export const inFlightTicketStatuses = ["open", "on_hold"];

export type DeletionBlocker = { kind: "order" | "return" | "ticket"; id: number; status: string };

/** What stops a Customer from deleting their account: Orders from placed to dispatched, Requested or Approved Returns, Open or On hold Tickets. */
export async function findDeletionBlockers<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(customerId: string, db: PgDatabase<TQueryResult, TSchema>): Promise<DeletionBlocker[]> {
  const [orderRows, returnRows, ticketRows] = await Promise.all([
    db.select({ id: orders.id, status: orders.status }).from(orders)
      .where(and(eq(orders.customerId, customerId), inArray(orders.status, inFlightOrderStatuses)))
      .orderBy(asc(orders.id)),
    db.select({ id: orderReturns.id, status: orderReturns.status }).from(orderReturns)
      .innerJoin(orders, eq(orders.id, orderReturns.orderId))
      .where(and(eq(orders.customerId, customerId), inArray(orderReturns.status, [...inFlightReturnStatuses] as never)))
      .orderBy(asc(orderReturns.id)),
    db.select({ id: tickets.id, status: tickets.status }).from(tickets)
      .where(and(eq(tickets.customerId, customerId), inArray(tickets.status, inFlightTicketStatuses)))
      .orderBy(asc(tickets.id)),
  ]);
  return [
    ...orderRows.map((row) => ({ kind: "order" as const, ...row })),
    ...returnRows.map((row) => ({ kind: "return" as const, ...row })),
    ...ticketRows.map((row) => ({ kind: "ticket" as const, ...row })),
  ];
}

/** Thrown by a deletion request while work is in flight; carries the blocking items. */
export class DeletionRefusedError extends Error {
  constructor(readonly blockers: DeletionBlocker[]) {
    super(
      `Your account can't be deleted yet. Still in progress: ${blockers.map((b) => `${b.kind} #${b.id} (${b.status})`).join(", ")}.`,
    );
    this.name = "DeletionRefusedError";
  }
}

/** Refuses a deletion request with every blocking item named, or resolves when nothing blocks. */
export async function assertCanDelete<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(customerId: string, db: PgDatabase<TQueryResult, TSchema>) {
  const blockers = await findDeletionBlockers(customerId, db);
  if (blockers.length > 0) throw new DeletionRefusedError(blockers);
}
