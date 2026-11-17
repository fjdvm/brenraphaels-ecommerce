import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AuditEvent } from "../lib/audit/gateway";
import { deleteAccount } from "../lib/customer/delete-account";
import { restoreReturningCustomer } from "../lib/customer/returning-customer";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(
    `insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in, created_at) values ('c1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', false, '2025-01-02T00:00:00Z')`,
  );
  await client.query(`insert into tickets (customer_id, subject, category, status) values ('c1', 'Old', 'order', 'resolved')`);
  await deleteAccount("c1", { db: drizzle(client) });
});
afterEach(async () => {
  await client.close();
});

const row = async () => (await client.query<Record<string, unknown>>(`select * from customers where id = 'c1'`)).rows[0];
const restore = (email: string, auth = { replacePassword: vi.fn().mockResolvedValue(undefined) }, audit?: (e: AuditEvent) => Promise<void>) =>
  restoreReturningCustomer(email, { db: drizzle(client), auth, audit });

describe("Returning Customer restored", () => {
  test("brings the same profile back with Customer since and history unchanged", async () => {
    const before = await row();
    expect(await restore("Jane@Example.com")).toBe("restored");
    const after = await row();
    expect(after.deleted_at).toBeNull();
    expect(after.created_at).toEqual(before.created_at);
    expect((await client.query(`select 1 from tickets where customer_id = 'c1'`)).rows).toHaveLength(1);
  });

  test("replaces the password before restoring, and restores nothing if that fails", async () => {
    const auth = { replacePassword: vi.fn().mockRejectedValue(new Error("down")) };
    await expect(restore("jane@example.com", auth)).rejects.toThrow("down");
    expect((await row()).deleted_at).not.toBeNull();
  });

  test("records one Customer returned event, with no email, even when run twice", async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    await restore("jane@example.com", undefined, audit);
    expect(await restore("jane@example.com", undefined, audit)).toBe("not-deleted");
    expect(audit).toHaveBeenCalledTimes(1);
    const event = audit.mock.calls[0][0] as AuditEvent;
    expect(event).toMatchObject({ action: "customer_returned", description: "Customer returned" });
    expect(JSON.stringify(event)).not.toContain("jane@example.com");
  });

  test("does nothing for an email that is not a Deleted Customer", async () => {
    const auth = { replacePassword: vi.fn() };
    expect(await restore("other@example.com", auth)).toBe("not-deleted");
    expect(auth.replacePassword).not.toHaveBeenCalled();
  });
});
