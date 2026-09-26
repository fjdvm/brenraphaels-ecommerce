import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createCustomerStore, signUpCustomer } from "../lib/customer/sign-up";
import { classifyVisitor } from "../lib/customer/visitor";
import { createVisitorStore } from "../lib/customer/visitor-store";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
});

afterEach(async () => {
  await client.close();
});

function visitorStore() {
  return createVisitorStore(drizzle(client));
}

async function signUpJane() {
  await signUpCustomer(
    {
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
      marketingOptIn: "no",
      terms: true,
    },
    {
      auth: {
        createLogin: async () => ({ userId: "neon-user-1" }),
        sendVerificationEmail: async () => undefined,
      },
      customerStore: createCustomerStore(drizzle(client)),
    },
  );
}

describe("Visitor classification", () => {
  test("a visitor without a session is signed out", async () => {
    await expect(
      classifyVisitor(null, { visitorStore: visitorStore() }),
    ).resolves.toEqual({ state: "signed-out" });
  });

  test("a signed-in login without Customer details still needs to finish them", async () => {
    await expect(
      classifyVisitor(
        { userId: "neon-user-2", email: "half@example.com", fullName: "Half Way" },
        { visitorStore: visitorStore() },
      ),
    ).resolves.toEqual({
      state: "needs-details",
      userId: "neon-user-2",
      email: "half@example.com",
      fullName: "Half Way",
    });
  });

  test("a signed-in login with Customer details is a complete Customer", async () => {
    await signUpJane();

    await expect(
      classifyVisitor(
        { userId: "neon-user-1", email: "jane@example.com", fullName: "Jane Doe" },
        { visitorStore: visitorStore() },
      ),
    ).resolves.toEqual({
      state: "customer",
      customer: {
        userId: "neon-user-1",
        fullName: "Jane Doe",
        email: "jane@example.com",
        contactNumber: "09171234567",
        addresses: [
          {
            id: expect.any(Number),
            label: "Home",
            street: "123 Katipunan Avenue",
            barangay: "Loyola Heights",
            city: "Quezon City",
            province: "Metro Manila",
            postalCode: "1108",
            country: "Philippines",
            isDefault: true,
          },
        ],
      },
    });
  });
});
