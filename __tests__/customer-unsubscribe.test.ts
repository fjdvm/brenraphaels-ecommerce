import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  unsubscribeCustomer,
  unsubscribeLink,
  unsubscribeToken,
} from "../lib/customer/unsubscribe";
import { customers } from "../lib/db/schema";

let client: PGlite;
let db: ReturnType<typeof drizzle>;

const secret = "test-secret-at-least-32-characters-long";
const siteUrl = "https://store.example";

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(customers).values([customer("customer-1", true), customer("customer-2", true)]);
});

afterEach(async () => {
  await client.close();
});

function customer(id: string, marketingOptIn: boolean) {
  return {
    id,
    firstName: "Ana",
    lastName: "Cruz",
    fullName: "Ana Cruz",
    email: `${id}@example.com`,
    contactNumber: "09171234567",
    marketingOptIn,
  };
}

async function optIn(id: string) {
  const [row] = await db.select().from(customers).where(eq(customers.id, id));
  return row.marketingOptIn;
}

function tokenOf(link: string) {
  return new URL(link).searchParams.get("token") ?? undefined;
}

describe("Unsubscribe link", () => {
  test("a valid link stops the Customer being a Subscriber, and only them", async () => {
    const token = tokenOf(unsubscribeLink("customer-1", { secret, siteUrl }));

    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("unsubscribed");

    expect(await optIn("customer-1")).toBe(false);
    expect(await optIn("customer-2")).toBe(true);
  });

  test("the link points at the public Unsubscribe page", () => {
    const link = unsubscribeLink("customer-1", { secret, siteUrl });

    expect(link.startsWith(`${siteUrl}/unsubscribe?token=`)).toBe(true);
  });

  test("opening the link twice is harmless", async () => {
    const token = tokenOf(unsubscribeLink("customer-1", { secret, siteUrl }));

    await unsubscribeCustomer(token, { secret, db });
    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("unsubscribed");

    expect(await optIn("customer-1")).toBe(false);
  });

  test("a Customer who already said no stays unsubscribed", async () => {
    await db.insert(customers).values(customer("customer-3", false));
    const token = tokenOf(unsubscribeLink("customer-3", { secret, siteUrl }));

    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("unsubscribed");
    expect(await optIn("customer-3")).toBe(false);
  });

  test("links are unique to each Customer", () => {
    expect(unsubscribeToken("customer-1", secret)).not.toBe(unsubscribeToken("customer-2", secret));
  });

  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["garbage", "not-a-token"],
    ["no signature", "Y3VzdG9tZXItMQ."],
  ])("a %s link changes nothing", async (_name, token) => {
    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("invalid");

    expect(await optIn("customer-1")).toBe(true);
    expect(await optIn("customer-2")).toBe(true);
  });

  test("a tampered link changes nothing", async () => {
    const [, signature] = unsubscribeToken("customer-1", secret).split(".");
    const otherId = Buffer.from("customer-2").toString("base64url");

    await expect(unsubscribeCustomer(`${otherId}.${signature}`, { secret, db })).resolves.toBe("invalid");
    await expect(
      unsubscribeCustomer(`${unsubscribeToken("customer-1", secret)}x`, { secret, db }),
    ).resolves.toBe("invalid");

    expect(await optIn("customer-1")).toBe(true);
    expect(await optIn("customer-2")).toBe(true);
  });

  test("a link signed with another secret changes nothing", async () => {
    const token = unsubscribeToken("customer-1", "some-other-secret-that-is-long-enough");

    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("invalid");
    expect(await optIn("customer-1")).toBe(true);
  });

  test("a correctly signed link for an unknown Customer is invalid", async () => {
    const token = unsubscribeToken("nobody", secret);

    await expect(unsubscribeCustomer(token, { secret, db })).resolves.toBe("invalid");
  });
});
