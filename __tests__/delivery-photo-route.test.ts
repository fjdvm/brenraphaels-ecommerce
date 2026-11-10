import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { customers, orders } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";

const { currentVisitor, getDatabase } = vi.hoisted(() => ({ currentVisitor: vi.fn(), getDatabase: vi.fn() }));
vi.mock("../lib/customer/current-visitor", () => ({ currentVisitor }));
vi.mock("../lib/db", () => ({ getDatabase }));
import { GET } from "../app/api/orders/[id]/delivery-photo/route";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
const gateway = vi.fn();

beforeAll(async () => {
  client = await createTestDatabase();
  db = drizzle(client);
});
afterAll(async () => { await client.close(); });

beforeEach(async () => {
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "key");
  vi.stubGlobal("fetch", gateway);
  getDatabase.mockReturnValue(db);
  currentVisitor.mockResolvedValue({ state: "customer", customer: { userId: "c1" } });
  await client.exec("TRUNCATE customers CASCADE");
  for (const id of ["c1", "c2"]) {
    await db.insert(customers).values({ id, firstName: "Maria", lastName: id, fullName: `Maria ${id}`,
      email: `${id}@example.com`, contactNumber: "09171234567", marketingOptIn: false });
  }
  gateway.mockImplementation(async () => Response.json({ id: "file-1", url: "https://files.test/file-1?sig=abc" }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); gateway.mockReset(); });

async function order(customerId: string, deliveryPhotoFileId: string | null) {
  const [row] = await db.insert(orders).values({ customerId, status: "delivered", fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000, deliveryPhotoFileId }).returning();
  return row.id;
}
const get = (id: number | string) => GET(new Request("http://shop.test"), { params: Promise.resolve({ id: String(id) }) } as never);

test("the owner is redirected to a short-lived signed address that is never cached", async () => {
  const response = await get(await order("c1", "file-1"));
  expect(response.status).toBe(302);
  expect(response.headers.get("Location")).toBe("https://files.test/file-1?sig=abc");
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(gateway.mock.calls[0][0]).toBe("https://gateway.test/files/file-1");
});

test("another Customer's Order never resolves an address", async () => {
  const response = await get(await order("c2", "file-1"));
  expect(response.status).toBe(404);
  expect(gateway).not.toHaveBeenCalled();
});

test("an Order without a photo answers 404 without asking the gateway", async () => {
  const response = await get(await order("c1", null));
  expect(response.status).toBe(404);
  expect(gateway).not.toHaveBeenCalled();
});

test("a visitor who is not a Customer is refused", async () => {
  currentVisitor.mockResolvedValue({ state: "guest" });
  expect((await get(await order("c1", "file-1"))).status).toBe(401);
  expect(gateway).not.toHaveBeenCalled();
});

test("a gateway failure or an unusable address is a 502, not a redirect", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const id = await order("c1", "file-1");
  gateway.mockResolvedValueOnce(new Response("no", { status: 500 }));
  expect((await get(id)).status).toBe(502);
  gateway.mockResolvedValueOnce(Response.json({ id: "file-1", url: "http://files.test/insecure" }));
  expect((await get(id)).status).toBe(502);
  expect((await get("abc")).status).toBe(400);
});
