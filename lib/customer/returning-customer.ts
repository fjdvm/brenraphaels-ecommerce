import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type { AuditEvent } from "../audit/gateway";
import type { WelcomeEmailStore } from "./sign-up";

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
    /** Sends the welcome-back email once per return. A failure never fails the restore. */
    welcomeBack?: {
      store: WelcomeEmailStore;
      send: (recipient: string, firstName: string) => Promise<void>;
    };
  },
): Promise<RestoreOutcome> {
  const { db, audit } = dependencies;

  const restored = await db.transaction(async (tx) => {
    const found = await tx.execute(
      sql`select id, deleted_at, first_name from customers where lower(email) = lower(${email}) and deleted_at is not null for update`,
    );
    const deleted = rows(found)[0] as { id: string; deleted_at: Date; first_name: string } | undefined;
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

  if (dependencies.welcomeBack) {
    const { store, send } = dependencies.welcomeBack;
    const customer = { type: "customer", id: loginId, display_name: "Customer" };
    // One claim per return (the Deleted Customer's id and deletion time), so a
    // retry sends one email and a second return later still gets its own.
    const claimKey = `welcome-back:${restored.id}:${new Date(restored.deleted_at).toISOString()}`;
    const recordOutcome = async (result: "sent" | "failed", reason?: string) => {
      if (!audit) return;
      try {
        await audit({
          source: "Ecommerce",
          action: "welcome_back_email",
          outcome: result === "sent" ? "success" : "failure",
          actor: customer,
          subject: customer,
          target: customer,
          description: result === "sent" ? "Welcome-back email sent" : `Welcome-back email failed: ${reason}`,
          occurred_at: new Date().toISOString(),
          idempotency_key: `welcome-back-email:${result}:${claimKey}`,
        });
      } catch (error) {
        console.error("Welcome-back email audit event failed", error);
      }
    };
    try {
      if (await store.claim(claimKey)) {
        try {
          await send(email.toLowerCase(), restored.first_name);
          await recordOutcome("sent");
        } catch (error) {
          await store.release(claimKey);
          await recordOutcome("failed", failureReason(error, email));
          throw error;
        }
      }
    } catch (error) {
      console.error("Welcome-back email failed", error);
    }
  }
  return "restored";
}

function failureReason(error: unknown, recipient: string) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message
      .replaceAll(recipient, "[email]")
      .replace(/[^\s<>"']+@[^\s<>"']+/g, "[email]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200) || "Unknown error"
  );
}

function rows(result: unknown): Row[] {
  return Array.isArray(result) ? (result as Row[]) : ((result as { rows: Row[] }).rows ?? []);
}
