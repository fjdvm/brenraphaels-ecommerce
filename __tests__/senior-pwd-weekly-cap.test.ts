import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, seniorPwdVerifications } from "../lib/db/schema";
import { createOrderStore } from "../lib/orders/orders";
import { capSeniorPwdDiscount, philippinePeriod, philippineWeek } from "../lib/senior-pwd/id-number";
import { createTestDatabase } from "./helpers/test-database";

vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail: vi.fn(async () => {}) }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.example.com",
}));

describe("the weekly window and the cap", () => {
  test("a week runs Monday to Sunday in Philippine Time", () => {
    // Sunday 23:30 PHT is still the old week; Monday 00:30 PHT starts the next.
    const sundayNight = philippineWeek(new Date("2026-11-22T15:30:00Z"));
    const mondayMorning = philippineWeek(new Date("2026-11-22T16:30:00Z"));
    expect(sundayNight.start.toISOString()).toBe("2026-11-15T16:00:00.000Z");
    expect(sundayNight.end.toISOString()).toBe("2026-11-22T16:00:00.000Z");
    expect(mondayMorning.start).toEqual(sundayNight.end);
  });

  test("a day and a month run on Philippine Time too", () => {
    // 23:30 PHT on 30 Nov is still November's last day; 00:30 PHT on 1 Dec is the next day and month.
    const lastNight = new Date("2026-11-30T15:30:00Z");
    const nextMorning = new Date("2026-11-30T16:30:00Z");
    expect(philippinePeriod(lastNight, "day")).toEqual({ start: new Date("2026-11-29T16:00:00Z"), end: new Date("2026-11-30T16:00:00Z") });
    expect(philippinePeriod(nextMorning, "day").start).toEqual(new Date("2026-11-30T16:00:00Z"));
    expect(philippinePeriod(lastNight, "month")).toEqual({ start: new Date("2026-10-31T16:00:00Z"), end: new Date("2026-11-30T16:00:00Z") });
    expect(philippinePeriod(nextMorning, "month").end).toEqual(new Date("2026-12-31T16:00:00Z"));
  });

  test("the cap follows the limit and period given, and names the period in its reason", () => {
    const capped = capSeniorPwdDiscount(5000, 28000, { limitInCentavos: 30000, per: "month" });
    expect(capped.discountInCentavos).toBe(2000);
    expect(capped.reason).toMatch(/₱280\.00 of its ₱300\.00 monthly limit/);
  });

  test("caps the discount at what is left of ₱125 and explains why", () => {
    expect(capSeniorPwdDiscount(1095, 0)).toEqual({ discountInCentavos: 1095, allowanceUsedInCentavos: 0, reason: null });
    const capped = capSeniorPwdDiscount(1095, 12000);
    expect(capped.discountInCentavos).toBe(500);
    expect(capped.reason).toMatch(/₱120\.00 of its ₱125\.00 weekly limit.*₱10\.95 to ₱5\.00/);
    expect(capSeniorPwdDiscount(1095, 12500).discountInCentavos).toBe(0);
  });
});

let client: PGlite;
beforeEach(async () => {
  client = await createTestDatabase();
  const db = drizzle(client);
  await db.insert(customers).values([1, 2].map((n) => ({ id: `c${n}`, firstName: "A", lastName: "B", fullName: "A B", email: `c${n}@example.com`, contactNumber: "09171234567", marketingOptIn: false })));
});
afterEach(async () => { await client.close(); });

async function approvedId(customerId: string, hash = "same-id") {
  const [v] = await drizzle(client).insert(seniorPwdVerifications).values({ customerId, idType: "senior", idHash: hash, status: "approved", expiresOn: "2099-01-01" }).returning();
  return v.id;
}
async function order(customerId: string, verificationId: number, wanted: number, extra = "") {
  const row = await client.query<{ id: number }>(
    `insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos, senior_pwd_verification_id, senior_pwd_discount_in_centavos ${extra ? ", " + extra.split("=")[0] : ""}) values ($1,'pickup','cash-on-delivery','placed',100000,$2,$3 ${extra ? ", " + extra.split("=")[1] : ""}) returning id`,
    [customerId, verificationId, wanted]);
  return row.rows[0].id;
}
const confirmWith = (store: ReturnType<typeof createOrderStore>, id: number, discount: number) =>
  store.confirm(id, { subtotalInCentavos: 100000, approvedDiscountInCentavos: discount, deliveryFeeInCentavos: null, totalInCentavos: 100000 - discount });

describe("the weekly cap at confirmation", () => {
  test("a second Order from the same ID gets only the allowance left, with the reason saved and readable", async () => {
    const store = createOrderStore(drizzle(client));
    const v = await approvedId("c1");
    const first = await order("c1", v, 8000);
    const second = await order("c1", v, 8000);
    await expect(confirmWith(store, first, 8000)).resolves.toMatchObject({ order: { seniorPwd: { discountInCentavos: 8000, allowanceUsedInCentavos: 0, reductionReason: null } } });
    // Staff can see the capped figure before confirming.
    expect((await store.listForCustomer("c1")).find((o) => o.id === second)?.seniorPwd).toMatchObject({ discountInCentavos: 4500, allowanceUsedInCentavos: 8000 });
    await expect(confirmWith(store, second, 8000)).rejects.toThrow(/approved discount/i);
    const done = await confirmWith(store, second, 4500);
    expect(done.order.approvedDiscountInCentavos).toBe(4500);
    expect(done.order.seniorPwd).toMatchObject({ discountInCentavos: 4500, allowanceUsedInCentavos: 8000, reductionReason: expect.stringContaining("reduced from ₱80.00 to ₱45.00") });
    expect(JSON.stringify(done.order)).not.toMatch(/same-id/);
  });

  test("an Order is capped by the limit and period it was placed under, not today's default", async () => {
    const store = createOrderStore(drizzle(client));
    const v = await approvedId("c1");
    const monthly = "senior_pwd_limit_in_centavos=30000";
    const first = await order("c1", v, 20000, monthly);
    const second = await order("c1", v, 20000, monthly);
    await client.query("update orders set senior_pwd_limit_per = 'month' where id in ($1, $2)", [first, second]);
    await confirmWith(store, first, 20000);
    // Under the old ₱125 weekly default nothing would be left; under ₱300 a month there is ₱100.
    expect((await store.listForCustomer("c1")).find((o) => o.id === second)?.seniorPwd).toMatchObject({ discountInCentavos: 10000, allowanceUsedInCentavos: 20000 });
  });

  test("the same ID on another account shares the allowance", async () => {
    const store = createOrderStore(drizzle(client));
    const first = await order("c1", await approvedId("c1"), 12500);
    await confirmWith(store, first, 12500);
    // Another verification row with the same hash (e.g. a resubmission).
    const second = await order("c2", await approvedId("c2"), 1000);
    await expect(confirmWith(store, second, 0)).resolves.toMatchObject({ order: { totalInCentavos: 100000 } });
  });

  test("a cancelled Order frees its allowance", async () => {
    const store = createOrderStore(drizzle(client));
    const v = await approvedId("c1");
    const first = await order("c1", v, 12500);
    const second = await order("c1", v, 3000);
    await confirmWith(store, first, 12500);
    await store.advance(first, { status: "cancelled", staffId: "ana", staffName: "Ana" });
    await expect(confirmWith(store, second, 3000)).resolves.toMatchObject({ order: { approvedDiscountInCentavos: 3000 } });
  });

  test("an Order confirmed in an earlier week does not count", async () => {
    const store = createOrderStore(drizzle(client));
    const v = await approvedId("c1");
    const old = await order("c1", v, 12500);
    await client.query("update orders set status='confirmed', approved_discount_in_centavos=12500, confirmed_at=now() - interval '8 days' where id=$1", [old]);
    const fresh = await order("c1", v, 5000);
    await expect(confirmWith(store, fresh, 5000)).resolves.toMatchObject({ order: { approvedDiscountInCentavos: 5000 } });
  });

  test("Orders confirmed at the same time cannot together pass the cap", async () => {
    const store = createOrderStore(drizzle(client));
    const v = await approvedId("c1");
    const a = await order("c1", v, 8000);
    const b = await order("c1", v, 8000);
    const results = await Promise.allSettled([confirmWith(store, a, 8000), confirmWith(store, b, 8000)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const total = (await client.query<{ t: number }>("select sum(approved_discount_in_centavos)::int t from orders")).rows[0].t;
    expect(total).toBeLessThanOrEqual(12500);
  });
});
