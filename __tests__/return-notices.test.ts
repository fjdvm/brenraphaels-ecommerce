import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { customers, orders, orderReturns } from "../lib/db/schema";
import { notifyReturnChange, type ReturnNoticeSenders } from "../lib/returns/return-notices";
import { createReturnStore } from "../lib/returns/returns";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
let sent: { email: unknown[]; notification: unknown[] };
let senders: ReturnNoticeSenders;
const staff = { type: "staff" as const, id: "ana", name: "Ana Reyes" };

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.test/");
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  [{ id: orderId }] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
  sent = { email: [], notification: [] };
  senders = { email: async (e) => void sent.email.push(e), notification: async (n) => void sent.notification.push(n) };
});
afterEach(async () => { await client.close(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function move(decision: object, seed: Partial<typeof orderReturns.$inferInsert> = {}, actor: typeof staff | { type: "customer"; id: string; name: string } = staff) {
  const [record] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 10000, ...seed }).returning();
  const updated = await createReturnStore(db).transition(record.id, actor, decision);
  await notifyReturnChange(db, updated, senders);
  return updated;
}

test("sends exactly one email and one Notification per event, linking to the Return in My orders", async () => {
  const cases: [object, Partial<typeof orderReturns.$inferInsert>, RegExp][] = [
    [{ status: "approved", goodsRequired: true }, {}, /approved/],
    [{ status: "declined", declineReason: "No defect found." }, {}, /declined/],
    [{ status: "goods received" }, { status: "approved", finalResolution: "refund", goodsRequired: true }, /goods received/],
    [{ status: "refunded", refundProofFileId: "proof-1" }, { status: "approved", finalResolution: "refund", goodsRequired: false }, /refunded/],
    [{ status: "replaced" }, { status: "approved", finalResolution: "replacement", goodsRequired: false }, /replaced/],
  ];
  for (const [decision, seed, title] of cases) {
    sent.email.length = sent.notification.length = 0;
    const record = await move(decision, seed);
    expect(sent.email).toHaveLength(1);
    expect(sent.notification).toHaveLength(1);
    expect(sent.email[0]).toMatchObject({ to: "maria@example.com", title: expect.stringMatching(title),
      button: { link: `https://shop.test/profile/orders?order=${orderId}` } });
    expect(sent.notification[0]).toMatchObject({ userId: "customer-1", title: expect.stringMatching(title),
      link: `https://shop.test/profile/orders?order=${orderId}` });
    expect(sent.email[0]).toMatchObject({ body: expect.stringContaining(`RMA-${record.id}`) });
  }
});

test("a requested Return notice carries its RMA number", async () => {
  const [record] = await db.insert(orderReturns).values({ orderId, reason: "damaged", amountInCentavos: 1 }).returning();
  await notifyReturnChange(db, record, senders);
  expect(sent.email).toMatchObject([{ title: `Return RMA-${record.id} requested` }]);
  expect(sent.notification).toHaveLength(1);
});

test("approval states the Resolution, whether goods return, and flags a change from the preference", async () => {
  await move({ status: "approved", finalResolution: "replacement", goodsRequired: true }, { preferredResolution: "refund" });
  expect(sent.email[0]).toMatchObject({ body: expect.stringMatching(/approved as a replacement[\s\S]*asked for a refund[\s\S]*send the goods back/) });
  sent.email.length = 0;
  await move({ status: "approved", goodsRequired: false }, { preferredResolution: "refund" });
  const { body } = sent.email[0] as { body: string };
  expect(body).toMatch(/approved as a refund/);
  expect(body).not.toMatch(/asked for/);
  expect(body).toMatch(/don't need to send the goods back/);
});

test("a decline shows the reason", async () => {
  await move({ status: "declined", declineReason: "No defect found." });
  expect(sent.email[0]).toMatchObject({ body: expect.stringContaining("Reason: No defect found.") });
});

test("cancelling a Return sends nothing", async () => {
  await move({ status: "cancelled" }, {}, { type: "customer", id: "customer-1", name: "Maria Santos" });
  expect(sent.email).toHaveLength(0);
  expect(sent.notification).toHaveLength(0);
});

test("a failing sender is logged and never throws; the other message still goes out", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  senders.email = async () => { throw new Error("mail down"); };
  await move({ status: "declined", declineReason: "No." });
  expect(sent.notification).toHaveLength(1);
  expect(error).toHaveBeenCalled();
});
