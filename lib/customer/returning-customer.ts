import { and, eq, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { AuditEvent } from "../audit/gateway";
import { customers } from "../db/schema";

export type ReturningCustomerAuth = {
  /** Replaces the login's password with the one typed at the new sign-up. */
  replacePassword(email: string): Promise<void>;
};

export type RestoreOutcome = "restored" | "not-deleted";

/**
 * Called only once the email is verified. A Deleted Customer who signed up again
 * gets the same profile back (history and Customer since untouched), after the
 * new password has replaced the old one; one "Customer returned" Audit Event is
 * recorded. If the password cannot be replaced nothing is restored.
 */
export async function restoreReturningCustomer<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  email: string,
  dependencies: {
    db: PgDatabase<TQueryResult, TSchema>;
    auth: ReturningCustomerAuth;
    audit?: (event: AuditEvent) => Promise<void>;
  },
): Promise<RestoreOutcome> {
  const { db, auth, audit } = dependencies;
  const [deleted] = await db
    .select({ id: customers.id, deletedAt: customers.deletedAt })
    .from(customers)
    .where(and(sql`lower(${customers.email}) = lower(${email})`, sql`${customers.deletedAt} is not null`))
    .limit(1);
  if (!deleted) return "not-deleted";

  await auth.replacePassword(email.toLowerCase());

  const claimed = await db
    .update(customers)
    .set({ deletedAt: null })
    .where(and(eq(customers.id, deleted.id), sql`${customers.deletedAt} is not null`))
    .returning({ id: customers.id });
  if (claimed.length === 0) return "not-deleted";

  if (audit) {
    const customer = { type: "customer", id: deleted.id, display_name: "Customer" };
    try {
      await audit({
        source: "Ecommerce",
        action: "customer_returned",
        outcome: "success",
        actor: customer,
        subject: customer,
        target: customer,
        description: "Customer returned",
        occurred_at: new Date().toISOString(),
        idempotency_key: `customer-returned:${deleted.id}:${deleted.deletedAt?.toISOString()}`,
      });
    } catch (error) {
      console.error("Customer returned audit event failed", error);
    }
  }
  return "restored";
}
