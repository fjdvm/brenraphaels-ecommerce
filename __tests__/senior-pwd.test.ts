import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { customers, orders, products, seniorPwdVerifications, sizes } from "../lib/db/schema";
import { createCartStore } from "../lib/orders/cart";
import { createOrderStore } from "../lib/orders/orders";
import { creomsSeniorPwdCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";
import { hashIdNumber, normalizeIdNumber, seniorPwdDiscount } from "../lib/senior-pwd/id-number";
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
const place = (customerId: string, seniorPwd: NonNullable<Parameters<ReturnType<typeof createOrderStore>["place"]>[1]["seniorPwd"]>, fulfillmentMethod: "pickup" | "delivery" = "pickup") =>
  createOrderStore(db, undefined, new FakeShopStock()).place(customerId, { fulfillmentMethod, paymentMethod: "cash-on-delivery", seniorPwd, ...(fulfillmentMethod === "delivery" ? {} : {}) });

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
  test("the discount is 5% of one unit", () => { expect(seniorPwdDiscount(21900)).toBe(1095); });
});

describe("placing an Order with the Senior/PWD discount", () => {
  test("holds the Order for the ID check and never stores the number", async () => {
    const lineId = await cartLine("c1");
    const order = await place("c1", { lineId, idType: "senior", idNumber: NUMBER, photoFileId: "front-1", photoBackFileId: "back-1" });
    expect(order.status).toBe("placed");
    const [row] = await db.select().from(orders);
    expect(row).toMatchObject({ status: "placed", seniorPwdDiscountInCentavos: 1095 });
    const [verification] = await db.select().from(seniorPwdVerifications);
    expect(verification).toMatchObject({ id: row.seniorPwdVerificationId, customerId: "c1", idType: "senior", status: "pending", photoFileId: "front-1", photoBackFileId: "back-1" });
    expect(JSON.stringify([row, verification])).not.toContain("0458721");
  });

  test("needs the type, number and a photo unless the Customer is already verified", async () => {
    const lineId = await cartLine("c1");
    await expect(place("c1", { lineId })).rejects.toThrow("type, number and a photo");
    expect(await db.select().from(orders)).toHaveLength(0);
  });

  test("refuses a line that is not in the Cart", async () => {
    await cartLine("c1");
    await expect(place("c1", { lineId: 9999, idType: "pwd", idNumber: NUMBER, photoFileId: "f" })).rejects.toThrow("Choose one item");
  });

  test("refuses an ID already used on another account", async () => {
    const first = await cartLine("c1");
    await place("c1", { lineId: first, idType: "senior", idNumber: NUMBER, photoFileId: "f1" });
    const second = await cartLine("c2");
    await expect(place("c2", { lineId: second, idType: "senior", idNumber: "ant sc 0458721", photoFileId: "f2" })).rejects.toThrow("already used on another account");
    expect(await db.select().from(orders)).toHaveLength(1);
  });

  test("an approved ID applies at once and the Order confirms as usual", async () => {
    await db.insert(seniorPwdVerifications).values({ customerId: "c1", idType: "pwd", idHash: "h", status: "approved", expiresOn: "2099-01-01" });
    const lineId = await cartLine("c1");
    const order = await place("c1", { lineId });
    expect(order.status).toBe("confirmed");
    const [row] = await db.select().from(orders);
    expect(row.seniorPwdDiscountInCentavos).toBe(1095);
    expect(row.seniorPwdVerificationId).not.toBeNull();
  });

  test("an expired approval no longer applies", async () => {
    await db.insert(seniorPwdVerifications).values({ customerId: "c1", idType: "pwd", idHash: "h", status: "approved", expiresOn: "2020-01-01" });
    const lineId = await cartLine("c1");
    await expect(place("c1", { lineId })).rejects.toThrow("type, number and a photo");
  });
});

describe("CREOMS decisions", () => {
  async function pending() {
    const lineId = await cartLine("c1");
    await place("c1", { lineId, idType: "senior", idNumber: NUMBER, photoFileId: "front-1", photoBackFileId: "back-1" });
    const [v] = await db.select().from(seniorPwdVerifications);
    return v.id;
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
