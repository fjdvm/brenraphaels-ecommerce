import { afterEach, expect, test, vi } from "vitest";
import { creomsStockCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";

const secret = "x".repeat(40);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function stubIms(handler: (url: URL) => Response) {
  vi.stubEnv("CREOMS_SERVICE_SECRET", secret);
  vi.stubEnv("IMS_URL", "https://ims.test");
  vi.stubEnv("IMS_SHOP_API_KEY", "k".repeat(40));
  vi.stubEnv("IMS_SIZE_PRODUCT_IDS", JSON.stringify({ 1: 101, 2: 102 }));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => handler(new URL(input))));
}
const call = async (query: string, token = mintCreomsCredential({ secret, ...creomsStockCredential })) => {
  const { GET } = await import("../app/api/internal/stock/route");
  return GET(new Request(`https://shop.test/api/internal/stock${query}`, { headers: { Authorization: `Bearer ${token}` } }));
};

test("CREOMS reads quantity, reserved and available per Size; a Size the IMS cannot answer is null", async () => {
  stubIms((url) => url.searchParams.get("productId") === "101"
    ? Response.json({ quantity: 26, reserved: 8, available: 18 }) : new Response("down", { status: 503 }));
  const response = await call("?sizeIds=1,2");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sizes: [
    { sizeId: 1, quantity: 26, reserved: 8, available: 18 },
    { sizeId: 2, quantity: null, reserved: null, available: null },
  ] });
});

test("refuses a missing, wrong-scope or malformed request", async () => {
  stubIms(() => Response.json({ quantity: 1, reserved: 0, available: 1 }));
  expect((await call("?sizeIds=1", "nope")).status).toBe(401);
  expect((await call("?sizeIds=1", mintCreomsCredential({ secret }))).status).toBe(401);
  expect((await call("?sizeIds=abc")).status).toBe(400);
  expect((await call("")).status).toBe(400);
});

test("CREOMS reads stock by IMS product id in one call, as the IMS Finished Goods tab counts it; an unknown product is null", async () => {
  const asked: string[] = [];
  stubIms((url) => {
    asked.push(`${url.pathname}?${url.searchParams.get("productIds")}`);
    return Response.json({ products: [{ productId: 55, quantity: 67, reserved: 7, available: 60 }] });
  });
  const response = await call("?productIds=55,56");
  expect(response.status).toBe(200);
  expect(asked).toEqual(["/api/shop/inventory?55,56"]);
  expect(await response.json()).toEqual({ products: [
    { productId: 55, quantity: 67, reserved: 7, available: 60 },
    { productId: 56, quantity: null, reserved: null, available: null },
  ] });
});

test("every product is null when the IMS inventory read fails", async () => {
  stubIms(() => new Response("down", { status: 503 }));
  expect(await (await call("?productIds=55")).json()).toEqual({ products: [{ productId: 55, quantity: null, reserved: null, available: null }] });
});

test("asks for either Sizes or products, never both, and bounds product ids", async () => {
  stubIms(() => Response.json({ quantity: 1, reserved: 0, available: 1 }));
  expect((await call("?sizeIds=1&productIds=2")).status).toBe(400);
  expect((await call("?productIds=0")).status).toBe(400);
});
