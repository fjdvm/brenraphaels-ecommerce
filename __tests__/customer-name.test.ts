import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  createCustomerNameStore,
  updateCustomerName,
} from "../lib/customer/name";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.query(
    `insert into customers (id, first_name, middle_name, last_name, full_name, email, contact_number, marketing_opt_in) values ('customer-1', 'Jane', 'Q', 'Doe', 'Jane Q Doe', 'jane@example.com', '09171234567', true), ('customer-2', 'John', null, 'Doe', 'John Doe', 'john@example.com', '09181112222', false)`,
  );
});

afterEach(async () => {
  await client.close();
});

describe("Customer name", () => {
  test("updates all stored name parts and its composed display name", async () => {
    await updateCustomerName(
      { firstName: "Janet", middleName: "R", lastName: "Smith" },
      {
        userId: "customer-1",
        customerNameStore: createCustomerNameStore(drizzle(client)),
      },
    );
    expect(
      await client.query(
        "select first_name, middle_name, last_name, full_name from customers where id = 'customer-1'",
      ),
    ).toMatchObject({
      rows: [
        {
          first_name: "Janet",
          middle_name: "R",
          last_name: "Smith",
          full_name: "Janet R Smith",
        },
      ],
    });
  });

  test("only changes the authenticated Customer", async () => {
    await updateCustomerName(
      { firstName: "Janet", middleName: "", lastName: "Smith" },
      {
        userId: "customer-1",
        customerNameStore: createCustomerNameStore(drizzle(client)),
      },
    );
    expect(
      await client.query("select full_name from customers order by id"),
    ).toMatchObject({
      rows: [{ full_name: "Janet Smith" }, { full_name: "John Doe" }],
    });
  });
});
