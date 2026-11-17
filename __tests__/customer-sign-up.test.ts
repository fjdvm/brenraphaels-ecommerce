import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  CustomerDetailsSaveError,
  SignUpAuthError,
  createCustomerStore,
  signUpCustomer,
  type CustomerSignUp,
} from "../lib/customer/sign-up";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;

const validSignUp: CustomerSignUp = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  password: "Password1!",
  confirmPassword: "Password1!",
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
  client = await createTestDatabase();
});

afterEach(async () => {
  await client.close();
});

function customerStore() {
  return createCustomerStore(drizzle(client));
}

function authStub(userId = "neon-user-1") {
  return {
    createLogin: vi.fn().mockResolvedValue({ userId }),
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  };
}

describe("Customer sign-up", () => {
  test.each(["Ab1!", "password1!", "Password!!", "Password11"])(
    "rejects the weak password %s on the server without creating a login",
    async (password) => {
      const auth = authStub();

      await expect(
        signUpCustomer(
          { ...validSignUp, password, confirmPassword: password },
          { auth, customerStore: customerStore() },
        ),
      ).rejects.toThrow();
      expect(auth.createLogin).not.toHaveBeenCalled();
    },
  );

  test("creates a login, Customer, and default Home Address", async () => {
    const auth = authStub();

    await signUpCustomer(validSignUp, { auth, customerStore: customerStore() });

    expect(auth.createLogin).toHaveBeenCalledWith({
      email: "jane@example.com",
      password: "Password1!",
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

  test("saves first, middle and last name and gives Neon the full name", async () => {
    const auth = authStub();

    await signUpCustomer(
      { ...validSignUp, firstName: "Jane", middleName: " Marie ", lastName: "Doe" },
      { auth, customerStore: customerStore() },
    );

    expect(auth.createLogin).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Jane Marie Doe" }),
    );
    expect(
      await client.query(
        "select first_name, middle_name, last_name, full_name from customers",
      ),
    ).toMatchObject({
      rows: [
        {
          first_name: "Jane",
          middle_name: "Marie",
          last_name: "Doe",
          full_name: "Jane Marie Doe",
        },
      ],
    });
  });

  test("leaves the middle name empty when there is none", async () => {
    await signUpCustomer(validSignUp, {
      auth: authStub(),
      customerStore: customerStore(),
    });

    expect(
      await client.query("select middle_name, full_name from customers"),
    ).toMatchObject({ rows: [{ middle_name: null, full_name: "Jane Doe" }] });
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
      { ...validSignUp, firstName: "John", email: "john@example.com" },
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

  test("reuses an unverified Customer's login, sends a fresh confirmation, and saves no duplicate data", async () => {
    const firstAttempt = authStub("neon-user-1");
    await signUpCustomer(validSignUp, {
      auth: firstAttempt,
      customerStore: customerStore(),
    });
    const repeatAttempt = authStub("synthetic-neon-user-id");

    await signUpCustomer(validSignUp, {
      auth: repeatAttempt,
      customerStore: customerStore(),
    });

    expect(repeatAttempt.createLogin).toHaveBeenCalledOnce();
    expect(repeatAttempt.sendVerificationEmail).toHaveBeenCalledWith("jane@example.com");
    expect(await client.query("select id from customers")).toMatchObject({
      rows: [{ id: "neon-user-1" }],
    });
    expect(await client.query("select customer_id from addresses")).toMatchObject({
      rows: [{ customer_id: "neon-user-1" }],
    });
  });

  test("gives an existing Verified Customer the neutral check-email response", async () => {
    await signUpCustomer(validSignUp, {
      auth: authStub("neon-user-1"),
      customerStore: customerStore(),
    });
    const repeatAttempt = authStub("synthetic-neon-user-id");

    await expect(
      signUpCustomer(validSignUp, {
        auth: repeatAttempt,
        customerStore: customerStore(),
      }),
    ).resolves.toEqual({ email: "jane@example.com" });

    // Neon Auth's resend endpoint deliberately sends nothing for a Verified
    // login while preserving this same neutral response.
    expect(repeatAttempt.sendVerificationEmail).toHaveBeenCalledWith("jane@example.com");
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

  test("reports a failed login creation without saving any Customer data", async () => {
    const auth = authStub();
    auth.createLogin.mockRejectedValue(new Error("Invalid origin"));

    const attempt = signUpCustomer(validSignUp, {
      auth,
      customerStore: customerStore(),
    });

    await expect(attempt).rejects.toBeInstanceOf(SignUpAuthError);
    await expect(attempt).rejects.toMatchObject({
      cause: expect.objectContaining({ message: "Invalid origin" }),
    });
    expect(await client.query("select id from customers")).toMatchObject({
      rows: [],
    });
  });

  test("reports a failed confirmation resend for an existing email", async () => {
    await signUpCustomer(validSignUp, {
      auth: authStub("neon-user-1"),
      customerStore: customerStore(),
    });
    const repeatAttempt = authStub();
    repeatAttempt.sendVerificationEmail.mockRejectedValue(new Error("Brevo down"));

    await expect(
      signUpCustomer(validSignUp, {
        auth: repeatAttempt,
        customerStore: customerStore(),
      }),
    ).rejects.toBeInstanceOf(SignUpAuthError);
  });

  describe("registration audit", () => {
    test("records one registration event with no email address", async () => {
      const audit = vi.fn().mockResolvedValue(undefined);

      await signUpCustomer(validSignUp, {
        auth: authStub("neon-user-1"),
        customerStore: customerStore(),
        audit,
      });

      expect(audit).toHaveBeenCalledOnce();
      const event = audit.mock.calls[0][0];
      expect(event).toMatchObject({
        action: "registration",
        outcome: "success",
        subject: { id: "neon-user-1" },
        idempotency_key: "registration:neon-user-1",
      });
      expect(JSON.stringify(event)).not.toContain("jane@example.com");
    });

    test("a retried sign-up sends the same idempotency key and creates one profile", async () => {
      const audit = vi.fn().mockResolvedValue(undefined);
      const store = customerStore();

      await signUpCustomer(validSignUp, { auth: authStub("neon-user-1"), customerStore: store, audit });
      await signUpCustomer(validSignUp, { auth: authStub("neon-user-1"), customerStore: store, audit });

      // The second attempt finds the email and only resends confirmation.
      expect(new Set(audit.mock.calls.map(([e]) => e.idempotency_key)).size).toBe(1);
      expect(await client.query("select id from customers")).toMatchObject({
        rows: [{ id: "neon-user-1" }],
      });
    });

    test("an audit failure does not fail sign-up", async () => {
      const audit = vi.fn().mockRejectedValue(new Error("gateway down"));

      await expect(
        signUpCustomer(validSignUp, { auth: authStub(), customerStore: customerStore(), audit }),
      ).resolves.toEqual({ email: "jane@example.com" });
    });
  });
});
