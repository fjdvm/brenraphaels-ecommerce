import { afterEach, expect, test, vi } from "vitest";
import { gatewayShopStock } from "../lib/orders/stock";
import { sendAppEmail } from "../lib/notifications/gateway";

afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv("IMS_URL", "https://ims.example.com/");
  vi.stubEnv("IMS_SHOP_API_KEY", "stock-key");
  vi.stubEnv("IMS_SIZE_PRODUCT_IDS", '{"7":123}');
}

test("a lost IMS response retries exactly the same authenticated no-cache reservation", async () => {
  configure();
  const line = { lineId: "size-7", productId: 123, quantity: 2 };
  const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error("Lost response"))
    .mockResolvedValueOnce(Response.json({ orderId: "checkout-1", ...line, state: "reserved" }));
  const stock = gatewayShopStock(fetcher);
  expect(stock.productForSize(7)).toBe(123);
  expect(await stock.move("reserve", "checkout-1", line)).toBe("reserved");
  expect(fetcher).toHaveBeenCalledTimes(2);
  for (const [url, init] of fetcher.mock.calls) {
    expect(url).toBe("https://ims.example.com/api/shop/stock");
    expect(init).toMatchObject({ method: "POST", cache: "no-store", headers: { Authorization: "Bearer stock-key", "Content-Type": "application/json" } });
    expect(JSON.parse(init!.body as string)).toEqual({ operation: "reserve", orderId: "checkout-1", ...line });
  }
});

test.each([404, 409])("a definitive stock refusal (%s) does not retry placement", async status => {
  configure();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
  await expect(gatewayShopStock(fetcher).move("reserve", "checkout-1", { lineId: "size-7", productId: 123, quantity: 2 })).rejects.toThrow("not enough stock");
  expect(fetcher).toHaveBeenCalledTimes(1);
});

test("missing Size mapping and unavailable IMS fail with the retry message", async () => {
  configure();
  expect(() => gatewayShopStock().productForSize(8)).toThrow("Try again in a few minutes");
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
  await expect(gatewayShopStock(fetcher).move("reserve", "checkout-1", { lineId: "size-7", productId: 123, quantity: 2 })).rejects.toThrow("Try again in a few minutes");
});

test("expiry App emails carry the gateway idempotency header", async () => {
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.example.com");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "caller-key");
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 202 }));
  await sendAppEmail({ to: "jane@example.com", title: "Your order was cancelled", body: "Payment was not confirmed.", idempotencyKey: "order.unpaid-cancelled:42" }, fetcher);
  expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ "Idempotency-Key": "order.unpaid-cancelled:42" });
});
