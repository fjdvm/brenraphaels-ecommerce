import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  addCustomerAddress,
  createAddressStore,
  CustomerAddressNotFoundError,
  deleteCustomerAddress,
  LastCustomerAddressError,
  setCustomerDefaultAddress,
  updateCustomerAddress,
} from "../lib/customer/addresses";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  await client.query(`
    insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in)
    values ('customer-1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', true)
  `);
  await client.query(`
    insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default)
    values ('customer-1', 'Home', '1 First Street', 'Barangay One', 'Quezon City', 'Metro Manila', '1100', 'Philippines', true)
  `);
  await client.query(`
    insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in)
    values ('customer-2', 'John', 'Doe', 'John Doe', 'john@example.com', '09181112222', false)
  `);
  await client.query(`
    insert into addresses (customer_id, label, street, barangay, city, province, postal_code, country, is_default)
    values ('customer-2', 'Home', '3 Third Street', 'Barangay Three', 'Manila', 'Metro Manila', '1000', 'Philippines', true)
  `);
});

afterEach(async () => {
  await client.close();
});

function addressStore() {
  return createAddressStore(drizzle(client));
}

describe("Customer Addresses", () => {
  test("adds an Address for the signed-in Customer without changing their Default address", async () => {
    await addCustomerAddress(
      {
        label: "Work",
        street: "2 Second Street",
        barangay: "Barangay Two",
        city: "Makati City",
        province: "Metro Manila",
        postalCode: "1200",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );

    expect(
      await client.query(
        "select label, street, country, is_default from addresses where customer_id = 'customer-1' order by id",
      ),
    ).toMatchObject({
      rows: [
        { label: "Home", street: "1 First Street", country: "Philippines", is_default: true },
        { label: "Work", street: "2 Second Street", country: "Philippines", is_default: false },
      ],
    });
    await expectExactlyOneDefaultAddress("customer-1");
  });

  test("edits an Address belonging to the signed-in Customer", async () => {
    await updateCustomerAddress(
      1,
      {
        label: "Other",
        street: "10 Updated Street",
        barangay: "Barangay Updated",
        city: "Pasig City",
        province: "Metro Manila",
        postalCode: "1600",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );

    expect(
      await client.query("select label, street, is_default from addresses where id = 1"),
    ).toMatchObject({
      rows: [{ label: "Other", street: "10 Updated Street", is_default: true }],
    });
    await expectExactlyOneDefaultAddress("customer-1");
  });

  test("sets one of a Customer's Addresses as their Default address", async () => {
    await addCustomerAddress(
      {
        label: "Work",
        street: "2 Second Street",
        barangay: "Barangay Two",
        city: "Makati City",
        province: "Metro Manila",
        postalCode: "1200",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );
    const addedAddress = await client.query<{ id: number }>(
      "select id from addresses where customer_id = 'customer-1' and label = 'Work'",
    );

    await setCustomerDefaultAddress(addedAddress.rows[0].id, {
      userId: "customer-1",
      addressStore: addressStore(),
    });

    await expectExactlyOneDefaultAddress("customer-1");
    expect(
      await client.query(
        "select label from addresses where customer_id = 'customer-1' and is_default = true",
      ),
    ).toMatchObject({ rows: [{ label: "Work" }] });
  });

  test("blocks deletion of a Customer's last Address", async () => {
    await expect(
      deleteCustomerAddress(1, { userId: "customer-1", addressStore: addressStore() }),
    ).rejects.toBeInstanceOf(LastCustomerAddressError);

    await expectExactlyOneDefaultAddress("customer-1");
  });

  test("promotes another Address when deleting the Default address", async () => {
    await addCustomerAddress(
      {
        label: "Work",
        street: "2 Second Street",
        barangay: "Barangay Two",
        city: "Makati City",
        province: "Metro Manila",
        postalCode: "1200",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );

    await deleteCustomerAddress(1, {
      userId: "customer-1",
      addressStore: addressStore(),
    });

    await expectExactlyOneDefaultAddress("customer-1");
    expect(
      await client.query(
        "select label from addresses where customer_id = 'customer-1' and is_default = true",
      ),
    ).toMatchObject({ rows: [{ label: "Work" }] });
  });

  test("deletes a non-default Address and keeps the Default address", async () => {
    await addCustomerAddress(
      {
        label: "Work",
        street: "2 Second Street",
        barangay: "Barangay Two",
        city: "Makati City",
        province: "Metro Manila",
        postalCode: "1200",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );
    const addedAddress = await client.query<{ id: number }>(
      "select id from addresses where customer_id = 'customer-1' and label = 'Work'",
    );

    await deleteCustomerAddress(addedAddress.rows[0].id, {
      userId: "customer-1",
      addressStore: addressStore(),
    });

    expect(
      await client.query(
        "select label, is_default from addresses where customer_id = 'customer-1'",
      ),
    ).toMatchObject({ rows: [{ label: "Home", is_default: true }] });
    await expectExactlyOneDefaultAddress("customer-1");
  });

  test("changing one Customer's Default address leaves another Customer's alone", async () => {
    await addCustomerAddress(
      {
        label: "Work",
        street: "2 Second Street",
        barangay: "Barangay Two",
        city: "Makati City",
        province: "Metro Manila",
        postalCode: "1200",
      },
      { userId: "customer-1", addressStore: addressStore() },
    );
    const addedAddress = await client.query<{ id: number }>(
      "select id from addresses where customer_id = 'customer-1' and label = 'Work'",
    );

    await setCustomerDefaultAddress(addedAddress.rows[0].id, {
      userId: "customer-1",
      addressStore: addressStore(),
    });

    await expectExactlyOneDefaultAddress("customer-1");
    await expectExactlyOneDefaultAddress("customer-2");
    expect(
      await client.query("select is_default from addresses where id = 2"),
    ).toMatchObject({ rows: [{ is_default: true }] });
  });

  test("refuses access to another Customer's Address", async () => {
    await expect(
      updateCustomerAddress(
        2,
        {
          label: "Other",
          street: "Changed Street",
          barangay: "Changed Barangay",
          city: "Manila",
          province: "Metro Manila",
          postalCode: "1000",
        },
        { userId: "customer-1", addressStore: addressStore() },
      ),
    ).rejects.toBeInstanceOf(CustomerAddressNotFoundError);
    await expect(
      setCustomerDefaultAddress(2, {
        userId: "customer-1",
        addressStore: addressStore(),
      }),
    ).rejects.toBeInstanceOf(CustomerAddressNotFoundError);
    await expect(
      deleteCustomerAddress(2, {
        userId: "customer-1",
        addressStore: addressStore(),
      }),
    ).rejects.toBeInstanceOf(CustomerAddressNotFoundError);

    expect(
      await client.query("select street from addresses where id = 2"),
    ).toMatchObject({ rows: [{ street: "3 Third Street" }] });    await expectExactlyOneDefaultAddress("customer-1");
    await expectExactlyOneDefaultAddress("customer-2");
  });
});

async function expectExactlyOneDefaultAddress(customerId: string) {
  expect(
    await client.query(
      `select count(*)::int as count from addresses where customer_id = '${customerId}' and is_default = true`,
    ),
  ).toMatchObject({ rows: [{ count: 1 }] });
}
