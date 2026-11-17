import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { AuditEvent } from "../lib/audit/gateway";
import { deleteAccount } from "../lib/customer/delete-account";
import { restoreReturningCustomer } from "../lib/customer/returning-customer";
import { signUpCustomer, type CustomerStore, type NeonAuth } from "../lib/customer/sign-up";
import { removeNeonLogin } from "../lib/neon-auth/management";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;
beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(
    `insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in, created_at) values ('old', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', false, '2025-01-02T00:00:00Z')`,
  );
  await client.query(`insert into tickets (customer_id, subject, category, status) values ('old', 'Old', 'order', 'resolved')`);
  await client.query(`insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default) values ('old', 'Home', 's', 'b', 'c', 'p', '1000', 'Philippines', true)`);
  await deleteAccount("old", { db: drizzle(client) });
});
afterEach(async () => {
  await client.close();
});

const rowsOf = async (sqlText: string) => (await client.query<Record<string, unknown>>(sqlText)).rows;
const restore = (loginId = "new", audit?: (e: AuditEvent) => Promise<void>) =>
  restoreReturningCustomer("Jane@Example.com", loginId, { db: drizzle(client), audit });

describe("Returning Customer restored", () => {
  test("brings the same profile back under the new login with Customer since and history unchanged", async () => {
    expect(await restore()).toBe("restored");
    const customers = await rowsOf(`select * from customers`);
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({ id: "new", email: "jane@example.com", full_name: "Jane Doe", deleted_at: null });
    expect((customers[0].created_at as Date).toISOString()).toBe("2025-01-02T00:00:00.000Z");
    expect(await rowsOf(`select 1 from tickets where customer_id = 'new'`)).toHaveLength(1);
    expect(await rowsOf(`select 1 from addresses where customer_id = 'new'`)).toHaveLength(1);
    expect(await rowsOf(`select 1 from tickets where customer_id = 'old'`)).toHaveLength(0);
  });

  test("records one Customer returned event, with no email, even when run twice", async () => {
    const audit = vi.fn().mockResolvedValue(undefined);
    await restore("new", audit);
    expect(await restore("new", audit)).toBe("not-deleted");
    expect(audit).toHaveBeenCalledTimes(1);
    const event = audit.mock.calls[0][0] as AuditEvent;
    expect(event).toMatchObject({ action: "customer_returned", description: "Customer returned", subject: { id: "new" } });
    expect(JSON.stringify(event)).not.toContain("jane@example.com");
  });

  test("does nothing for an email that is not a Deleted Customer", async () => {
    expect(await restoreReturningCustomer("other@example.com", "x", { db: drizzle(client) })).toBe("not-deleted");
  });
});

describe("Signing up again as a Deleted Customer", () => {
  const input = {
    firstName: "Jane", middleName: "", lastName: "Doe", email: "jane@example.com", contactNumber: "09171234567",
    password: "NewPassword1!", confirmPassword: "NewPassword1!", marketingOptIn: "no", terms: true, street: "1 St", barangay: "B", city: "C", province: "P", postalCode: "1000",
  } as unknown as Parameters<typeof signUpCustomer>[0];
  const store = (): CustomerStore => ({
    hasEmail: async (email) => (await rowsOf(`select 1 from customers where email = '${email}'`)).length > 0,
    findDeletedId: async (email) => (await rowsOf(`select id from customers where email = '${email}' and deleted_at is not null`))[0]?.id as string ?? null,
    save: vi.fn().mockResolvedValue("saved"),
  });

  test("removes the old login, creates a fresh one, and restores nothing before verification", async () => {
    const auth: NeonAuth = { createLogin: vi.fn().mockResolvedValue({ userId: "new" }), sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
    const removeLogin = vi.fn().mockResolvedValue(undefined);
    const customerStore = store();
    await signUpCustomer(input, { auth, customerStore, removeLogin });
    expect(removeLogin).toHaveBeenCalledWith("old");
    expect(removeLogin.mock.invocationCallOrder[0]).toBeLessThan((auth.createLogin as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]);
    expect(auth.createLogin).toHaveBeenCalledWith(expect.objectContaining({ password: "NewPassword1!" }));
    expect(customerStore.save).not.toHaveBeenCalled();
    expect((await rowsOf(`select deleted_at from customers`))[0].deleted_at).not.toBeNull();
  });

  test("never removes a login for a Customer who is not deleted", async () => {
    await client.query(`update customers set deleted_at = null`);
    const removeLogin = vi.fn();
    const auth: NeonAuth = { createLogin: vi.fn().mockResolvedValue({ userId: "x" }), sendVerificationEmail: vi.fn().mockResolvedValue(undefined) };
    await signUpCustomer(input, { auth, customerStore: store(), removeLogin });
    expect(removeLogin).not.toHaveBeenCalled();
  });
});

describe("removeNeonLogin", () => {
  const env = { NEON_API_KEY: "k", NEON_PROJECT_ID: "p", NEON_BRANCH_ID: "b" };
  test("deletes the user through the management API; a missing user is fine", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
    await removeNeonLogin("old", fetcher, env);
    expect(fetcher).toHaveBeenCalledWith(
      "https://console.neon.tech/api/v2/projects/p/branches/b/auth/users/old",
      expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer k" } }),
    );
  });
  test("fails on a server error and when not configured", async () => {
    await expect(removeNeonLogin("old", vi.fn().mockResolvedValue(new Response(null, { status: 500 })), env)).rejects.toThrow("HTTP 500");
    await expect(removeNeonLogin("old", vi.fn(), {})).rejects.toThrow("NEON_API_KEY");
  });
});
