import sharp from "sharp";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { customers, orders, orderReturns, orderReturnHistory } from "../lib/db/schema";
import { creomsReturnCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";
import { POST } from "../app/api/internal/returns/[id]/status/route";

const database = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase: database.get }));
let client: PGlite;
let db: ReturnType<typeof drizzle>;
let orderId: number;
const staff = { staffId: "ana", staffName: "Ana Reyes" };
let png: Buffer;
let metadata: Record<string, unknown>;
let linkedReturn: number;
let bytes: Uint8Array;
let calls: { url: string; init?: RequestInit }[];

beforeEach(async () => {
  vi.stubEnv("CREOMS_SERVICE_SECRET", "k".repeat(40));
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  client = new PGlite();
  db = drizzle(client);
  database.get.mockReturnValue(db);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(customers).values({ id: "customer-1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
    email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
  const [order] = await db.insert(orders).values({ customerId: "customer-1", status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
  orderId = order.id;
  png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  linkedReturn = 0;
  bytes = png;
  metadata = { id: "proof-1", status: "active", contentType: "image/png", size: png.length,
    visibility: "private", retentionType: "permanent", expiresAt: null, url: "https://storage.test/proof" };
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL, init?: RequestInit) => {
    const url = new URL(input);
    calls.push({ url: url.toString(), init });
    if (url.hostname === "storage.test") return new Response(bytes as BodyInit);
    if (url.search) {
      expect(url.searchParams.get("system")).toBe("CRMS");
      expect(url.searchParams.get("entityType")).toBe("return");
      expect(url.searchParams.get("role")).toBe("refund-proof");
      return Response.json({ files: url.searchParams.get("entityId") === String(linkedReturn) ? [{ id: "proof-1" }] : [], nextPage: null });
    }
    return Response.json(metadata);
  }));
});
afterEach(async () => { await client.close(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

async function requested(preferredResolution: "refund" | "replacement" = "refund") {
  const [record] = await db.insert(orderReturns).values({ orderId, preferredResolution, reason: "damaged", amountInCentavos: 10000 }).returning();
  linkedReturn = record.id;
  return record.id;
}
function call(id: number | string, decision: unknown, token: string | null = mintCreomsCredential(creomsReturnCredential)) {
  return POST(new Request(`https://storefront.test/api/internal/returns/${id}/status`, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof decision === "string" ? decision : JSON.stringify(decision),
  }), { params: Promise.resolve({ id: String(id) }) });
}

test("defaults approval to the Customer preference, skips goods received, and confirms committed Staff attribution", async () => {
  const id = await requested("replacement");
  const response = await call(id, { status: "approved", ...staff });
  expect(response.status).toBe(200);
  const approved = await response.json();
  expect(approved).toMatchObject({ id, status: "approved", finalResolution: "replacement", goodsRequired: false,
    actedBy: { id: "ana", name: "Ana Reyes" } });
  expect(new Date(approved.actedBy.at).toISOString()).toBe(approved.actedBy.at);
  expect((await call(id, { status: "replaced", staffId: "ben", staffName: "Ben Cruz" })).status).toBe(200);
  expect(await db.select().from(orderReturnHistory)).toMatchObject([
    { returnId: id, status: "approved", actorId: "ana", actorName: "Ana Reyes", occurredAt: new Date(approved.actedBy.at) },
    { returnId: id, status: "replaced", actorId: "ben", actorName: "Ben Cruz" },
  ]);
  expect(await db.select().from(orders)).toMatchObject([{ status: "delivered" }]);
  expect(calls).toHaveLength(0);
});

test("checks every Staff move against the status, final Resolution and goods requirement", async () => {
  const statuses = ["requested", "approved", "goods received", "refunded", "replaced", "declined", "cancelled"] as const;
  for (const from of statuses) {
    for (const resolution of ["refund", "replacement"] as const) {
      for (const goodsRequired of [true, false]) {
        const allowed = from === "requested" ? ["approved", "declined"]
          : from === "approved" ? (goodsRequired ? ["goods received"] : [resolution === "refund" ? "refunded" : "replaced"])
          : from === "goods received" ? [resolution === "refund" ? "refunded" : "replaced"] : [];
        for (const status of ["approved", "declined", "goods received", "refunded", "replaced"]) {
          const [record] = await db.insert(orderReturns).values({ orderId, reason: "other", amountInCentavos: 10000,
            status: from, finalResolution: resolution, goodsRequired }).returning();
          linkedReturn = record.id;
          const response = await call(record.id, { status, ...staff,
            ...(status === "declined" ? { declineReason: "  No defect found.  " } : {}),
            ...(status === "refunded" ? { refundProofFileId: "proof-1" } : {}),
          });
          expect(response.status, `${from} -> ${status} (${resolution}, goods=${goodsRequired})`).toBe(allowed.includes(status) ? 200 : 409);
          const result = await response.json();
          if (response.ok) {
            expect(result).toMatchObject({ id: record.id, status });
            if (status === "declined") expect(result.declineReason).toBe("No defect found.");
            if (status === "refunded") expect(result.refundProofFileId).toBe("proof-1");
          } else expect(result.error).toMatch(/not allowed/);
        }
      }
    }
  }
});

test("requires the Returns credential, rejects Orders credentials and malformed ids/bodies without writing", async () => {
  const id = await requested();
  for (const token of [null, "invalid", mintCreomsCredential(), mintCreomsCredential({ ...creomsReturnCredential, secret: "wrong" }),
    mintCreomsCredential({ ...creomsReturnCredential, now: new Date(Date.now() - 1_000_000) })]) {
    expect((await call(id, { status: "approved", ...staff }, token)).status).toBe(401);
  }
  for (const invalidId of ["0", "-1", "1e0", "1.0", "9007199254740992"]) {
    expect((await call(invalidId, { status: "approved", ...staff })).status).toBe(400);
  }
  for (const body of ["{", null, { status: "cancelled", ...staff }, { status: "requested", ...staff },
    { status: "approved" }, { status: "approved", ...staff, staffName: "<script>" },
    { status: "approved", ...staff, occurredAt: "2020-01-01" },
    { status: "approved", ...staff, goodsRequired: "false" }, { status: "approved", ...staff, finalResolution: "credit" },
    { status: "declined", ...staff }, { status: "declined", ...staff, declineReason: "   " },
    { status: "declined", ...staff, declineReason: "<script>" }, { status: "declined", ...staff, declineReason: "x".repeat(2001) },
    { status: "refunded", ...staff }, { status: "refunded", ...staff, refundProofFileId: "https://file" },
    { status: "replaced", ...staff, refundProofFileId: "proof-1" }]) {
    const response = await call(id, body);
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
  }
  expect((await call(99999, { status: "approved", ...staff })).status).toBe(404);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(0);
  expect(calls).toHaveLength(0);
});

test("verifies refund proof before committing and never sends the Caller key to storage", async () => {
  const id = await requested("replacement");
  expect((await call(id, { status: "approved", finalResolution: "refund", goodsRequired: true, ...staff })).status).toBe(200);
  expect((await call(id, { status: "goods received", ...staff })).status).toBe(200);
  const response = await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id, status: "refunded", refundProofFileId: "proof-1" });
  expect(await db.select().from(orderReturns)).toMatchObject([{ refundedAt: expect.any(Date), refundProofFileId: "proof-1" }]);
  expect(calls[0].init).toMatchObject({ headers: { Authorization: "Bearer storefront-key" }, cache: "no-store", redirect: "error" });
  expect(calls.at(-1)?.init?.headers).toBeUndefined();
});

test("refuses unconfirmed, public, temporary, oversized, unrelated or spoofed proof without changing the Return", async () => {
  const id = await requested();
  await call(id, { status: "approved", ...staff });
  const good = { ...metadata };
  for (const bad of [{ status: "pending" }, { visibility: "public" }, { retentionType: "temporary" },
    { size: 5_242_881 }, { size: 0 }, { id: "other" }, { contentType: "application/pdf" }, { expiresAt: "2027-01-01" }]) {
    metadata = { ...good, ...bad };
    expect((await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff })).status).toBe(400);
  }
  metadata = good;
  linkedReturn = id + 1;
  expect((await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff })).status).toBe(400);
  linkedReturn = id;
  bytes = new Uint8Array(png.length).fill(65);
  expect((await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff })).status).toBe(400);
  expect(await db.select().from(orderReturns)).toMatchObject([{ status: "approved", refundProofFileId: null }]);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(1);
});

test("racing approval and decline have one winner; uncertain database failures return a safe reason", async () => {
  const id = await requested();
  const results = await Promise.all([call(id, { status: "approved", ...staff }), call(id, { status: "declined", declineReason: "No defect.", ...staff })]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(1);
  const another = await requested();
  await client.exec("ALTER TABLE order_return_history ADD CONSTRAINT reject_history CHECK (false) NOT VALID");
  const failed = await call(another, { status: "approved", ...staff });
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ error: "Return decision could not be confirmed. Refresh before retrying." });
  expect(await db.select().from(orderReturns)).toMatchObject([{ id, status: expect.any(String) }, { id: another, status: "requested" }]);
});

test("a gateway outage refuses the refund with a refresh reason and no status/history write", async () => {
  const id = await requested();
  await call(id, { status: "approved", ...staff });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private gateway details")));
  const response = await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff });
  expect(response.status).toBe(503);
  expect((await response.json()).error).toMatch(/Refresh before retrying/);
  expect(await db.select().from(orderReturnHistory)).toHaveLength(1);
});


test("rejects truncated JPG/PNG payloads despite valid signatures and accepts a decoded JPEG", async () => {
  const id = await requested();
  await call(id, { status: "approved", ...staff });
  for (const [contentType, payload] of [
    ["image/jpeg", Buffer.from([255, 216, 255, 217])],
    ["image/png", png.subarray(0, 24)],
  ] as const) {
    bytes = payload;
    metadata = { ...metadata, contentType, size: payload.length };
    expect((await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff })).status).toBe(400);
  }
  expect(await db.select().from(orderReturnHistory)).toHaveLength(1);
  bytes = await sharp(png).jpeg().toBuffer();
  metadata = { ...metadata, contentType: "image/jpeg", size: bytes.length };
  expect((await call(id, { status: "refunded", refundProofFileId: "proof-1", ...staff })).status).toBe(200);
});
