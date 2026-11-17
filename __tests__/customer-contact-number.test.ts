import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createContactNumberStore,
  updateCustomerContactNumber,
} from "../lib/customer/contact-number";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(`
    insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in)
    values
      ('customer-1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', true),
      ('customer-2', 'John', 'Doe', 'John Doe', 'john@example.com', '09181112222', false)
  `);
});

afterEach(async () => {
  await client.close();
});

function contactNumberStore() {
  return createContactNumberStore(drizzle(client));
}

describe("Customer Contact number", () => {
  test("changes a Customer's Contact number", async () => {
    await updateCustomerContactNumber(
      { contactNumber: "+63 917 555 0101" },
      { userId: "customer-1", contactNumberStore: contactNumberStore() },
    );

    expect(
      await client.query("select contact_number from customers where id = 'customer-1'"),
    ).toMatchObject({ rows: [{ contact_number: "+639175550101" }] });
  });

  test("rejects an invalid Contact number", async () => {
    await expect(
      updateCustomerContactNumber(
        { contactNumber: "12345" },
        { userId: "customer-1", contactNumberStore: contactNumberStore() },
      ),
    ).rejects.toThrow("Enter a valid PH mobile number");

    expect(
      await client.query("select contact_number from customers where id = 'customer-1'"),
    ).toMatchObject({ rows: [{ contact_number: "09171234567" }] });
  });

  test("changes only the signed-in Customer's Contact number", async () => {
    await updateCustomerContactNumber(
      { contactNumber: "09175550101" },
      { userId: "customer-1", contactNumberStore: contactNumberStore() },
    );

    expect(
      await client.query("select id, contact_number from customers order by id"),
    ).toMatchObject({
      rows: [
        { id: "customer-1", contact_number: "09175550101" },
        { id: "customer-2", contact_number: "09181112222" },
      ],
    });
  });
});

describe("Customer Contact number audit", () => {
  test("records field names only, and nothing when unchanged", async () => {
    const audit = vi.fn(async () => {});
    await updateCustomerContactNumber(
      { contactNumber: "09171234567" },
      { userId: "customer-1", contactNumberStore: contactNumberStore(), audit },
    );
    expect(audit).not.toHaveBeenCalled();

    await updateCustomerContactNumber(
      { contactNumber: "09175550101" },
      { userId: "customer-1", contactNumberStore: contactNumberStore(), audit },
    );
    expect(audit).toHaveBeenCalledTimes(1);
    const event = (audit.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(event.action).toBe("profile_updated");
    expect(event.description).toBe("Profile updated: contactNumber");
    expect(JSON.stringify(event)).not.toContain("0917555");
  });
});
