import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orders, products, seniorPwdVerifications, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";
import { creomsSeniorPwdCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";
import { hashIdNumber, normalizeIdNumber } from "../lib/senior-pwd/id-number";
import { DEFAULT_DISCOUNT_RULE, discountedLine, ruleDiscount, type DiscountRule } from "../lib/senior-pwd/discount-rule";
import { idNumberInUse, submitVerification } from "../lib/senior-pwd/store";
import { POST } from "../app/api/internal/senior-pwd/[id]/[action]/route";
import { FakeShopStock } from "./helpers/fake-shop-stock";
import { createTestDatabase } from "./helpers/test-database";

const afterTasks = vi.hoisted(() => [] as Array<() => Promise<void>>);
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { afterTasks.push(task); } }));
const database = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: database.get }));
const sendMail = vi.hoisted(() => vi.fn(async (_message: { text: string; subject: string }) => {}));
vi.mock("../lib/email/brevo-transport", () => ({
  createBrevoTransport: () => ({ transport: { sendMail }, sender: "shop@example.com" }),
  requiredEnvironment: () => "https://shop.test",
}));
const removed = vi.hoisted(() => [] as string[]);
vi.mock("@/lib/support/ticket-files", () => ({ gatewayTicketFiles: () => ({ remove: async (id: string) => { removed.push(id); } }) }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged: vi.fn() }));

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const NUMBER = "ANT-SC-0458721";
const staff = { staffId: "ana", staffName: "Ana Reyes" };

async function customer(id: string, email: string) {
  await db.insert(customers).values({ id, firstName: id, lastName: "Test", fullName: `${id} Test`, email, contactNumber: "09171234567", marketingOptIn: false });
}
async function cartLine(customerId: string) {
  const [size] = await db.select().from(sizes);
  const cart = await createCartStore(db).addSize(customerId, size.id, 2);
  return cart.lines[0].id;
}
const place = (customerId: string, rule: DiscountRule = DEFAULT_DISCOUNT_RULE) =>
  createOrderStore(db, undefined, new FakeShopStock(), undefined, async () => null, undefined, async () => rule)
    .place(customerId, { fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery" });
const approve = (customerId: string, idHash = `h-${customerId}`) =>
  db.insert(seniorPwdVerifications).values({ customerId, idType: "pwd", idHash, status: "approved", expiresOn: "2099-01-01" });

beforeEach(async () => {
  afterTasks.length = 0; removed.length = 0; sendMail.mockClear();
  vi.stubEnv("SENIOR_PWD_ID_SECRET", "s".repeat(40));
  vi.stubEnv("CREOMS_SERVICE_SECRET", "k".repeat(40));
  client = await createTestDatabase();
  db = drizzle(client);
  database.get.mockReturnValue(db);
  await customer("c1", "maria@example.com");
  await customer("c2", "jose@example.com");
  await db.insert(products).values({ slug: "ube-jam", name: "Ube Jam", description: "Ube jam." });
  await db.insert(sizes).values({ productSlug: "ube-jam", label: "250g", priceInCentavos: 21900, available: true });
});
afterEach(async () => { await client.close(); vi.unstubAllEnvs(); });

describe("the ID number", () => {
  test("is hashed with a keyed hash, ignoring spaces, hyphens and case", () => {
    const secret = "s".repeat(40);
    expect(hashIdNumber(NUMBER, secret)).toBe(hashIdNumber("ant sc 0458721", secret));
    expect(hashIdNumber(NUMBER, secret)).not.toContain("0458721");
    expect(hashIdNumber(NUMBER, secret)).not.toBe(hashIdNumber(NUMBER, "t".repeat(40)));
    expect(normalizeIdNumber("ant-sc 04")).toBe("ANTSC04");
  });
  test("needs a server secret of 32 characters", () => {
    expect(() => hashIdNumber(NUMBER, "short")).toThrow("SENIOR_PWD_ID_SECRET");
  });
});

describe("the CREOMS discount rule", () => {
  test("the default is today's rule: 5% of one unit", () => { expect(ruleDiscount(DEFAULT_DISCOUNT_RULE, 21900)).toBe(1095); });
  test("a pesos rule takes a fixed amount, never more than the unit costs", () => {
    const pesos: DiscountRule = { kind: "pesos", hundredths: 5_000, limitInCentavos: 50_000, per: "month" };
    expect(ruleDiscount(pesos, 21900)).toBe(5_000);
    expect(ruleDiscount(pesos, 3_000)).toBe(3_000);
  });
  test("goes to one unit of the priciest item", () => {
    expect(discountedLine([{ id: 1, priceInCentavos: 10_000 }, { id: 2, priceInCentavos: 30_000 }, { id: 3, priceInCentavos: 20_000 }])?.id).toBe(2);
    expect(discountedLine([])).toBeUndefined();
  });
});

describe("placing an Order with the Senior/PWD discount", () => {
  test("an Order from a Customer with no ID is at full price, with no discount saved", async () => {
    await cartLine("c1");
    const order = await place("c1");
    expect(order.status).toBe("confirmed");
    const [row] = await db.select().from(orders);
    expect(row).toMatchObject({ seniorPwdVerificationId: null, seniorPwdDiscountInCentavos: null, seniorPwdLimitInCentavos: null });
  });

  test("an ID still being checked gives no discount and never holds the Order", async () => {
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "front-1" });
    await cartLine("c1");
    const order = await place("c1");
    expect(order.status).toBe("confirmed");
    const [row] = await db.select().from(orders);
    expect(row).toMatchObject({ seniorPwdVerificationId: null, seniorPwdDiscountInCentavos: null });
  });

  test("an approved ID applies the CREOMS rule automatically and the Order confirms as usual", async () => {
    await approve("c1");
    await cartLine("c1");
    const order = await place("c1");
    expect(order.status).toBe("confirmed");
    const [row] = await db.select().from(orders);
    expect(row.seniorPwdDiscountInCentavos).toBe(1095);
    expect(row.seniorPwdVerificationId).not.toBeNull();
  });

  test("the Order keeps the rule it was placed under", async () => {
    await approve("c1");
    await cartLine("c1");
    await place("c1", { kind: "percent", hundredths: 1_000, limitInCentavos: 30_000, per: "month" });
    const [row] = await db.select().from(orders);
    expect(row).toMatchObject({ seniorPwdDiscountInCentavos: 2190, seniorPwdLimitInCentavos: 30_000, seniorPwdLimitPer: "month" });
  });

  test("an expired approval no longer applies", async () => {
    await db.insert(seniorPwdVerifications).values({ customerId: "c1", idType: "pwd", idHash: "h", status: "approved", expiresOn: "2020-01-01" });
    await cartLine("c1");
    await place("c1");
    const [row] = await db.select().from(orders);
    expect(row.seniorPwdDiscountInCentavos).toBeNull();
  });

  test("keeps the expiry date the Customer confirmed, apart from the date Staff confirm", async () => {
    const withDate = await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, expiryDeclared: "2099-03-15", photoFileId: "f1" });
    const noDate = await submitVerification(db, "c2", { idType: "pwd", idNumber: "PWD-9", photoFileId: "f2" });
    const rows = await db.select().from(seniorPwdVerifications);
    expect(rows.find((row) => row.id === withDate)).toMatchObject({ expiryDeclared: "2099-03-15", expiresOn: null });
    expect(rows.find((row) => row.id === noDate)?.expiryDeclared).toBeNull();
  });

  test("a number last seen declined on another account is accepted but flagged for Staff", async () => {
    const first = await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "f1" });
    await db.update(seniorPwdVerifications).set({ status: "declined" });
    const second = await submitVerification(db, "c2", { idType: "senior", idNumber: "ant sc 0458721", photoFileId: "f2" });
    const rows = await db.select().from(seniorPwdVerifications);
    expect(rows.find((row) => row.id === first)?.sameIdAsVerificationId).toBeNull();
    expect(rows.find((row) => row.id === second)?.sameIdAsVerificationId).toBe(first);
  });

  test("two accounts sending the same number together cannot both get in", async () => {
    const results = await Promise.allSettled([
      submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "f1" }),
      submitVerification(db, "c2", { idType: "senior", idNumber: NUMBER, photoFileId: "f2" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await db.select().from(seniorPwdVerifications)).toHaveLength(1);
  });

  test("the same ID cannot be sent from a second account while it is in use", async () => {
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "f1" });
    await expect(submitVerification(db, "c2", { idType: "senior", idNumber: "ant sc 0458721", photoFileId: "f2" })).rejects.toThrow("already used by another account");
    expect(JSON.stringify(await db.select().from(seniorPwdVerifications))).not.toContain("0458721");
  });

  test("the pre-check finds a number pending or approved elsewhere, but never the Customer's own or a declined one", async () => {
    expect(await idNumberInUse(db, NUMBER)).toBe(false);
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "f1" });
    expect(await idNumberInUse(db, "ant sc 0458721")).toBe(true);
    expect(await idNumberInUse(db, NUMBER, "c2")).toBe(true);
    expect(await idNumberInUse(db, NUMBER, "c1")).toBe(false);
    await db.update(seniorPwdVerifications).set({ status: "approved", expiresOn: "2099-01-01" });
    expect(await idNumberInUse(db, NUMBER, "c2")).toBe(true);
    await db.update(seniorPwdVerifications).set({ status: "declined" });
    expect(await idNumberInUse(db, NUMBER, "c2")).toBe(false);
  });

  test("keeps only how the number read off the photo compared, never the number", async () => {
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, idNumberRead: "ANT SC 0458721", photoFileId: "f1" });
    await db.update(seniorPwdVerifications).set({ status: "declined" });
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, idNumberRead: "ANT-SC-0458727", photoFileId: "f2" });
    await db.update(seniorPwdVerifications).set({ status: "declined" });
    await submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "f3" });
    const rows = await db.select().from(seniorPwdVerifications).orderBy(seniorPwdVerifications.id);
    expect(rows.map((row) => row.idNumberRead)).toEqual(["matched", "differs", "unread"]);
    expect(JSON.stringify(rows)).not.toMatch(/045872[17]/);
  });
});

describe("CREOMS decisions", () => {
  async function pending() {
    return submitVerification(db, "c1", { idType: "senior", idNumber: NUMBER, photoFileId: "front-1", photoBackFileId: "back-1" });
  }
  const call = (id: number | string, action: string, body: object, token = mintCreomsCredential(creomsSeniorPwdCredential)) =>
    POST(new Request(`https://shop.test/api/internal/senior-pwd/${id}/${action}`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: String(id), action }) } as never);
  async function drain() { for (const task of afterTasks.splice(0)) await task(); }

  test("refuses a missing or wrong credential", async () => {
    const id = await pending();
    expect((await POST(new Request("https://shop.test/x", { method: "POST", body: "{}" }), { params: Promise.resolve({ id: String(id), action: "approve" }) } as never)).status).toBe(401);
    expect((await call(id, "approve", {}, mintCreomsCredential())).status).toBe(401);
  });

  test("approve records who decided, clears and deletes the photos, and emails once without the number", async () => {
    const id = await pending();
    const response = await call(id, "approve", { expiresOn: "2099-01-01", ...staff });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id, status: "approved", expiresOn: "2099-01-01" });
    await drain();
    const [v] = await db.select().from(seniorPwdVerifications);
    expect(v).toMatchObject({ status: "approved", photoFileId: null, photoBackFileId: null, decidedById: "ana", decidedByName: "Ana Reyes" });
    // The name the ID was verified under is kept beside the hash.
    expect(v.verifiedName).toBe("c1 Test");
    expect(v.idHash).toBe(hashIdNumber(NUMBER));
    expect(removed.sort()).toEqual(["back-1", "front-1"]);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0].text).toContain("verified");
    expect(sendMail.mock.calls[0][0].text).not.toContain("0458721");
  });

  test("decline needs a reason, which the Customer is told", async () => {
    const id = await pending();
    expect((await call(id, "decline", { ...staff })).status).toBe(400);
    expect((await call(id, "decline", { reason: "The photo is blurry", ...staff })).status).toBe(200);
    await drain();
    expect((await db.select().from(seniorPwdVerifications))[0].verifiedName).toBeNull();
    expect(sendMail.mock.calls[0][0].text).toContain("The photo is blurry");
  });

  test("a second decision on the same verification is a conflict, with no second email", async () => {
    const id = await pending();
    await call(id, "decline", { reason: "Blurry", ...staff });
    expect((await call(id, "decline", { reason: "Blurry", ...staff })).status).toBe(409);
    expect((await call(id, "approve", { expiresOn: "2099-01-01", ...staff })).status).toBe(409);
    await drain();
    expect(sendMail).toHaveBeenCalledTimes(1);
  });

  test("a Manager override approves a declined ID; revoke needs an approved one and a reason", async () => {
    const id = await pending();
    await call(id, "decline", { reason: "Blurry", ...staff });
    expect((await call(id, "approve", { expiresOn: "2099-01-01", override: true, ...staff })).status).toBe(200);
    expect((await call(id, "revoke", { ...staff })).status).toBe(400);
    expect((await call(id, "revoke", { reason: "Not theirs", ...staff })).status).toBe(200);
    expect((await call(id, "revoke", { reason: "Again", ...staff })).status).toBe(409);
  });

  test("refuses an expiry date in the past or malformed, unknown ids and bad input", async () => {
    const id = await pending();
    expect((await call(id, "approve", { expiresOn: "2020-01-01", ...staff })).status).toBe(400);
    expect((await call(id, "approve", { expiresOn: "soon", ...staff })).status).toBe(400);
    expect((await call(id, "approve", { expiresOn: "2099-01-01" })).status).toBe(400);
    expect((await call(9999, "approve", { expiresOn: "2099-01-01", ...staff })).status).toBe(404);
    expect((await call("abc", "approve", {})).status).toBe(400);
    expect((await call(id, "delete", {})).status).toBe(404);
  });

  test("refuses to verify an ID already verified on another account", async () => {
    const id = await pending();
    const [mine] = await db.select().from(seniorPwdVerifications);
    await db.insert(seniorPwdVerifications).values({ customerId: "c2", idType: "senior", idHash: mine.idHash, status: "approved", expiresOn: "2099-01-01" });
    const response = await call(id, "approve", { expiresOn: "2099-01-01", ...staff });
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("already verified on another account");
  });

  test("a pending ID whose photo is 7 days old can no longer be reviewed", async () => {
    const id = await pending();
    await db.update(seniorPwdVerifications).set({ submittedAt: new Date(Date.now() - 8 * 86_400_000) });
    expect((await call(id, "approve", { expiresOn: "2099-01-01", ...staff })).status).toBe(409);
  });
});
