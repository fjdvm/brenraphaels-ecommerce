import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AuditEvent } from "../lib/audit/gateway";
import { DeletionRefusedError } from "../lib/customer/deletion";
import { deleteAccount, isDeletedCustomerEmail } from "../lib/customer/delete-account";
import { signInCustomer } from "../lib/customer/sign-in";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(
    `insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in) values ('c1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', false)`,
  );
});
afterEach(async () => {
  await client.close();
});

const run = (audit?: (e: AuditEvent) => Promise<void>) => deleteAccount("c1", { db: drizzle(client), audit });
const row = async () =>
  (await client.query<Record<string, unknown>>(`select * from customers where id = 'c1'`)).rows[0];

describe("Soft-delete the account", () => {
  test("marks the profile deleted and keeps every field", async () => {
    await run();
    const customer = await row();
    expect(customer.deleted_at).toBeInstanceOf(Date);
    expect(customer).toMatchObject({
      first_name: "Jane", full_name: "Jane Doe", email: "jane@example.com", contact_number: "09171234567",
    });
  });

  test("records one account deleted Audit Event, with no email, even when asked twice", async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    await run(audit);
    await run(audit);
    expect(audit).toHaveBeenCalledTimes(1);
    const event = audit.mock.calls[0][0] as AuditEvent;
    expect(event).toMatchObject({ action: "account_deleted", outcome: "success", subject: { id: "c1" } });
    expect(JSON.stringify(event)).not.toContain("jane@example.com");
  });

  test("a failing audit never fails the deletion", async () => {
    await run(vi.fn().mockRejectedValue(new Error("down")));
    expect((await row()).deleted_at).not.toBeNull();
  });

  test("is refused, and nothing changes, while work is in flight", async () => {
    await client.query(
      `insert into tickets (customer_id, subject, category, status) values ('c1', 'Help', 'order', 'open')`,
    );
    const audit = vi.fn();
    await expect(run(audit)).rejects.toBeInstanceOf(DeletionRefusedError);
    expect((await row()).deleted_at).toBeNull();
    expect(audit).not.toHaveBeenCalled();
  });

  test("login can no longer sign in", async () => {
    const signIn = vi.fn().mockResolvedValue("signed-in");
    const attempt = () =>
      signInCustomer(
        { email: "jane@example.com", password: "Password1!" },
        { auth: { signIn }, isDeleted: (email) => isDeletedCustomerEmail(email, drizzle(client)) },
      );
    expect(await attempt()).toEqual({ status: "signed-in" });
    await run();
    expect(await attempt()).toMatchObject({ status: "invalid" });
    expect(signIn).toHaveBeenCalledTimes(1);
  });
});
