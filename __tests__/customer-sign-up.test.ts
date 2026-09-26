import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  CustomerDetailsSaveError,
  createCustomerStore,
  signUpCustomer,
  type CustomerSignUp,
} from "../lib/customer/sign-up";

let client: PGlite;

const validSignUp: CustomerSignUp = {
  fullName: "Jane Doe",
  email: "jane@example.com",
  password: "Password1",
  confirmPassword: "Password1",
  contactNumber: "09171234567",
  street: "123 Katipunan Avenue",
  barangay: "Loyola Heights",
  city: "Quezon City",
  province: "Metro Manila",
  postalCode: "1108",
  marketingOptIn: "yes",
  terms: true,
};

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
});

afterEach(async () => {
  await client.close();
});

function customerStore() {
  return createCustomerStore(drizzle(client));
}

function authStub(userId = "neon-user-1") {
  return { createLogin: vi.fn().mockResolvedValue({ userId }) };
}

describe("Customer sign-up", () => {
  test("creates a login, Customer, and default Home Address", async () => {
    const auth = authStub();

    await signUpCustomer(validSignUp, { auth, customerStore: customerStore() });

    expect(auth.createLogin).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Password1",
      fullName: "Jane Doe",
    });
    expect(
      await client.query(
        "select id, email, contact_number, marketing_opt_in from customers",
      ),
    ).toMatchObject({
      rows: [
        {
          id: "neon-user-1",
          email: "jane@example.com",
          contact_number: "09171234567",
          marketing_opt_in: true,
        },
      ],
    });
    expect(
      await client.query(
        "select label, is_default, country, barangay from addresses",
      ),
    ).toMatchObject({
      rows: [
        {
          label: "Home",
          is_default: true,
          country: "Philippines",
          barangay: "Loyola Heights",
        },
      ],
    });
  });

  test("rejects an invalid Contact number before creating a login", async () => {
    const auth = authStub();

    await expect(
      signUpCustomer(
        { ...validSignUp, contactNumber: "not-a-contact-number" },
        { auth, customerStore: customerStore() },
      ),
    ).rejects.toThrow("Enter a valid PH mobile number");

    expect(auth.createLogin).not.toHaveBeenCalled();
  });

  test("does not require Contact numbers to be unique", async () => {
    await signUpCustomer(validSignUp, {
      auth: authStub("neon-user-1"),
      customerStore: customerStore(),
    });
    await signUpCustomer(
      { ...validSignUp, fullName: "John Doe", email: "john@example.com" },
      { auth: authStub("neon-user-2"), customerStore: customerStore() },
    );

    expect(
      await client.query(
        "select contact_number from customers order by email",
      ),
    ).toMatchObject({
      rows: [
        { contact_number: "09171234567" },
        { contact_number: "09171234567" },
      ],
    });
  });

  test("keeps a created login when saving Customer details fails, without partial rows", async () => {
    await client.query(
      "alter table addresses add constraint postal_code_cannot_be_0000 check (postal_code <> '0000')",
    );
    const auth = authStub("neon-user-that-needs-a-profile");

    await expect(
      signUpCustomer(
        { ...validSignUp, postalCode: "0000" },
        { auth, customerStore: customerStore() },
      ),
    ).rejects.toBeInstanceOf(CustomerDetailsSaveError);

    expect(auth.createLogin).toHaveBeenCalledTimes(1);
    expect(
      await client.query(
        "select id from customers where id = 'neon-user-that-needs-a-profile'",
      ),
    ).toMatchObject({ rows: [] });
    expect(await client.query("select id from addresses")).toMatchObject({
      rows: [],
    });
  });
});
