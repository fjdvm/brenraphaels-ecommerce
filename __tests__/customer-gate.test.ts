import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { VisitorSession } from "../lib/customer/visitor";

// Only the framework edges are replaced: the session, the database handle, and
// Next.js's redirect() (which throws) and headers().
let session: VisitorSession = null;
let database: ReturnType<typeof drizzle>;
let returnPath: string | null = null;

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(returnPath ? { "x-return-path": returnPath } : {}),
}));
vi.mock("@/lib/neon-auth/server", () => ({ getVisitorSession: async () => session }));
vi.mock("@/lib/db", () => ({ getDatabase: () => database }));

const { requireCustomer, requireVisitorNeedingDetails } = await import(
  "../lib/customer/current-visitor"
);
const { completeCustomerProfile } = await import("../lib/customer/complete-profile");
const { createCustomerStore } = await import("../lib/customer/sign-up");

let client: PGlite;

const jane = { userId: "neon-user-1", email: "jane@example.com", fullName: "Jane Doe" };

beforeEach(async () => {
  client = new PGlite();
  database = drizzle(client);
  await migrate(database, { migrationsFolder: "drizzle" });
  session = null;
  returnPath = null;
});

afterEach(async () => {
  await client.close();
});

async function becomeCompleteCustomer() {
  await completeCustomerProfile(
    {
      firstName: "Jane",
      lastName: "Doe",
      contactNumber: "09171234567",
      street: "123 Katipunan Avenue",
      barangay: "Loyola Heights",
      city: "Quezon City",
      province: "Metro Manila",
      postalCode: "1108",
      marketingOptIn: "yes",
      terms: true,
    },
    { identity: jane, customerStore: createCustomerStore(database) },
  );
}

describe("Protected paths", () => {
  test("send a login without Customer details to the complete-profile form", async () => {
    session = jane;

    await expect(requireCustomer()).rejects.toThrow("REDIRECT /complete-profile");
  });

  test("send a signed-out Visitor to sign in, remembering where they were going", async () => {
    returnPath = "/profile?tab=addresses";

    await expect(requireCustomer()).rejects.toThrow(
      `REDIRECT /signin?next=${encodeURIComponent("/profile?tab=addresses")}`,
    );
  });

  test("let a complete Customer through", async () => {
    session = jane;
    await becomeCompleteCustomer();

    await expect(requireCustomer()).resolves.toMatchObject({
      userId: "neon-user-1",
      email: "jane@example.com",
    });
  });
});

describe("The complete-profile form", () => {
  test("opens for a login without Customer details", async () => {
    session = jane;

    await expect(requireVisitorNeedingDetails()).resolves.toMatchObject({
      state: "needs-details",
      email: "jane@example.com",
    });
  });

  test("redirects a Customer with complete details to their profile", async () => {
    session = jane;
    await becomeCompleteCustomer();

    await expect(requireVisitorNeedingDetails()).rejects.toThrow("REDIRECT /profile");
  });

  test("redirects a signed-out Visitor to sign in", async () => {
    await expect(requireVisitorNeedingDetails()).rejects.toThrow("REDIRECT /signin");
  });
});
