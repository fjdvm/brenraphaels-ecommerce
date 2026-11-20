import { afterEach, expect, test, vi } from "vitest";
import { creomsStockCredential, mintCreomsCredential } from "../lib/orders/creoms-credential";

const secret = "x".repeat(40);
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function stubIms(handler: (url: URL) => Response) {
  vi.stubEnv("CREOMS_SERVICE_SECRET", secret);
  vi.stubEnv("IMS_URL", "https://ims.test");
  vi.stubEnv("IMS_SHOP_API_KEY", "k".repeat(40));
  vi.stubGlobal("fetch", vi.fn(async (input: string) => handler(new URL(input))));
}
const call = async (token = mintCreomsCredential({ secret, ...creomsStockCredential })) => {
  const { GET } = await import("../app/api/internal/products/route");
  return GET(new Request("https://shop.test/api/internal/products", { headers: { Authorization: `Bearer ${token}` } }));
};
const item = { productId: 55, name: "Toffee Jam", variant: "301 Milliliters Jar", image: null, price: 150, active: true };

test("CREOMS reads the IMS product feed through the storefront, which holds the IMS key", async () => {
  stubIms((url) => url.pathname === "/api/shop/products" ? Response.json({ products: [item] }) : new Response("?", { status: 404 }));
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ products: [item] });
});

test("refuses a missing or wrong-scope credential, and says so when the IMS cannot answer", async () => {
  stubIms(() => new Response("down", { status: 503 }));
  expect((await call("nope")).status).toBe(401);
  expect((await call(mintCreomsCredential({ secret }))).status).toBe(401);
  expect((await call()).status).toBe(502);
});
