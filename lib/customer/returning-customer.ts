import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { AuditEvent } from "../audit/gateway";

export type RestoreOutcome = "restored" | "not-deleted";

type Row = Record<string, unknown>;

/**
 * Called only once the email is verified, with the id of the fresh login that
 * signing up again created. The Deleted Customer's profile comes back under
 * that login: the row keeps every field (so Customer since is unchanged) and
 * every record that pointed at the old login id, in any table with a
 * `customer_id` column, now points at the new one. One "Customer returned"
 * Audit Event is recorded, with no email address.
 */
export async function restoreReturningCustomer<
  TQueryResult extends PgQueryResultHKT,
  TSchema extends Record<string, unknown>,
>(
  email: string,
  loginId: string,
  dependencies: {
    db: PgDatabase<TQueryResult, TSchema>;
    audit?: (event: AuditEvent) => Promise<void>;
  },
): Promise<RestoreOutcome> {
  const { db, audit } = dependencies;

  const restored = await db.transaction(async (tx) => {
    const found = await tx.execute(
      sql`select id, deleted_at from customers where lower(email) = lower(${email}) and deleted_at is not null for update`,
    );
    const deleted = rows(found)[0] as { id: string; deleted_at: Date } | undefined;
    if (!deleted) return null;

    if (deleted.id !== loginId) {
      const columns = rows(
        await tx.execute(
          sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'customers' order by ordinal_position`,
        ),
      ).map((r) => String(r.column_name));
      const lit = (value: string) => `'${value.replaceAll("'", "''")}'`;
      const quote = (name: string) => `"${name}"`;
      const copied = columns.map((c) =>
        c === "id" ? lit(loginId) : c === "deleted_at" ? "null" : c === "email" ? `replace(email, ${lit(`#replaced:${deleted.id}`)}, '')` : quote(c),
      );
      // The email is unique, so the old row steps aside before the copy is inserted.
      await tx.execute(sql`update customers set email = email || '#replaced:' || id where id = ${deleted.id}`);
      await tx.execute(
        sql.raw(
          `insert into customers (${columns.map(quote).join(", ")}) select ${copied.join(", ")} from customers where id = ${lit(deleted.id)}`,
        ),
      );
      const children = rows(
        await tx.execute(
          sql`select table_name, column_name from information_schema.columns where table_schema = 'public' and column_name = 'customer_id' and data_type = 'text' and table_name <> 'customers' and table_name in (select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')`,
        ),
      );
      for (const child of children) {
        await tx.execute(
          sql`update ${sql.identifier(String(child.table_name))} set ${sql.identifier(String(child.column_name))} = ${loginId} where ${sql.identifier(String(child.column_name))} = ${deleted.id}`,
        );
      }
      await tx.execute(sql`delete from customers where id = ${deleted.id}`);
    } else {
      await tx.execute(sql`update customers set deleted_at = null where id = ${deleted.id}`);
    }
    return deleted;
  });
  if (!restored) return "not-deleted";

  if (audit) {
    const customer = { type: "customer", id: loginId, display_name: "Customer" };
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
        idempotency_key: `customer-returned:${restored.id}:${new Date(restored.deleted_at).toISOString()}`,
      });
    } catch (error) {
      console.error("Customer returned audit event failed", error);
    }
  }
  return "restored";
}

function rows(result: unknown): Row[] {
  return Array.isArray(result) ? (result as Row[]) : ((result as { rows: Row[] }).rows ?? []);
}
