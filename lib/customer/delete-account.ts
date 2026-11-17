import { and, eq, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { AuditEvent } from "../audit/gateway";
import { customers } from "../db/schema";
import { assertCanDelete } from "./deletion";

/** True when the email belongs to a Customer who deleted their account. */
export async function isDeletedCustomerEmail<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(email: string, db: PgDatabase<TQueryResult, TSchema>): Promise<boolean> {
  const rows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(sql`lower(${customers.email}) = lower(${email})`, sql`${customers.deletedAt} is not null`))
    .limit(1);
  return rows.length > 0;
}

/**
 * Soft-deletes a Customer's account: refused while work is in flight, otherwise
 * the profile is marked deleted (which also disables the login, see
 * `signInCustomer`) and one "account deleted" Audit Event is recorded. Nothing
 * is deleted or nulled. Asking again does nothing and records nothing more.
 */
export async function deleteAccount<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  customerId: string,
  dependencies: { db: PgDatabase<TQueryResult, TSchema>; audit?: (event: AuditEvent) => Promise<void> },
) {
  const { db, audit } = dependencies;
  await assertCanDelete(customerId, db);

  const claimed = await db
    .update(customers)
    .set({ deletedAt: new Date() })
    .where(and(eq(customers.id, customerId), isNull(customers.deletedAt)))
    .returning({ id: customers.id });
  if (claimed.length === 0 || !audit) return;

  const customer = { type: "customer", id: customerId, display_name: "Customer" };
  try {
    await audit({
      source: "Ecommerce",
      action: "account_deleted",
      outcome: "success",
      actor: customer,
      subject: customer,
      target: customer,
      description: "Account deleted",
      occurred_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Account deleted audit event failed", error);
  }
}
