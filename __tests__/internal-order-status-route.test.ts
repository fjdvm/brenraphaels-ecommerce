import { mintCreomsCredential } from "@/lib/orders/creoms-credential";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const {
  advance,
  createOrderStore,
  customerEmailForOrder,
  customerIdForOrder,
  getDatabase,
  publishCustomerOrderEvent,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderPaidEmail,
} = vi.hoisted(() => ({
  advance: vi.fn(),
  createOrderStore: vi.fn(() => ({ advance, customerEmailForOrder, customerIdForOrder })),
  customerEmailForOrder: vi.fn(),
  customerIdForOrder: vi.fn(),
  getDatabase: vi.fn(),
  publishCustomerOrderEvent: vi.fn(),
  sendOrderConfirmedEmail: vi.fn(),
  sendOrderDeliveredEmail: vi.fn(),
  sendOrderPaidEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/email/order-confirmed-email", () => ({ sendOrderConfirmedEmail }));
vi.mock("@/lib/email/order-delivered-email", () => ({ sendOrderDeliveredEmail }));
vi.mock("@/lib/email/order-paid-email", () => ({ sendOrderPaidEmail }));
vi.mock("@/lib/orders/live-events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/live-events")>()),
  publishCustomerOrderEvent,
}));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore,
}));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeAll(async () => {
  ({ POST: post } = await import("../app/api/internal/orders/[id]/status/route"));
});

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

beforeEach(() => {
  vi.stubEnv("API_GATEWAY_URL", "https://gateway.test");
  vi.stubEnv("API_GATEWAY_CALLER_KEY", "storefront-key");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ id: "photo-1", status: "active", visibility: "private", contentType: "image/jpeg" })));
  process.env.CREOMS_SERVICE_SECRET = "k".repeat(40);
  advance.mockReset().mockResolvedValue({
    id: 12,
    status: "confirmed",
    fulfillmentMethod: "delivery",
    deliveryFeeInCentavos: 8000,
    subtotalInCentavos: 21900,
  });
  customerEmailForOrder.mockReset().mockResolvedValue("jane@example.com");
  customerIdForOrder.mockReset().mockResolvedValue("customer-7");
  publishCustomerOrderEvent.mockReset().mockResolvedValue(undefined);
  sendOrderConfirmedEmail.mockReset().mockResolvedValue(undefined);
  sendOrderDeliveredEmail.mockReset().mockResolvedValue(undefined);
  sendOrderPaidEmail.mockReset().mockResolvedValue(undefined);
  createOrderStore.mockClear();
  getDatabase.mockClear();
});

function statusRequest(credential = mintCreomsCredential()) {
  return new Request("https://shop.example.test/api/internal/orders/12/status", {
    body: JSON.stringify({ status: "confirmed", deliveryFeeInCentavos: 8000 }),
    headers: {
      "Authorization": `Bearer ${credential}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

const context = { params: Promise.resolve({ id: "12" }) };

describe("POST /api/internal/orders/[id]/status", () => {
  test("accepts a request carrying a valid CREOMS service credential", async () => {
    expect((await post(statusRequest(), context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "confirmed", deliveryFeeInCentavos: 8000 });
    expect(customerEmailForOrder).toHaveBeenCalledWith(12);
    expect(sendOrderConfirmedEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({
      id: 12,
      deliveryFeeInCentavos: 8000,
      subtotalInCentavos: 21900,
    }));
  });

  test("emails the Customer once staff mark a GCash Order paid", async () => {
    advance.mockResolvedValue({
      id: 12,
      status: "paid",
      paidById: "staff-17",
      paidByName: "Ana de la Cruz",
      paidAt: new Date("2026-10-22T12:00:00Z"),
      fulfillmentMethod: "pickup",
      deliveryFeeInCentavos: null,
      subtotalInCentavos: 21900,
    });
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "paid", staffId: "staff-17", staffName: "Ana de la Cruz" }),
      headers: { "Authorization": `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    const response = await post(request, context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      paidById: "staff-17", paidByName: "Ana de la Cruz", paidAt: "2026-10-22T12:00:00.000Z",
    });
    expect(advance).toHaveBeenCalledWith(12, { status: "paid", staffId: "staff-17", staffName: "Ana de la Cruz" });
    expect(customerEmailForOrder).toHaveBeenCalledWith(12);
    expect(sendOrderPaidEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: 12, status: "paid" }));
    expect(sendOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  test.each([
    {}, { staffId: "staff-17" }, { staffName: "Ana Cruz" },
    { staffId: "", staffName: "Ana Cruz" }, { staffId: "staff-17", staffName: " " },
    { staffId: 17, staffName: "Ana Cruz" }, { staffId: "staff-17", staffName: "<script>" },
  ])("refuses incomplete or invalid paid attribution before any write: %j", async (staff) => {
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "paid", ...staff }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });
    expect((await post(request, context)).status).toBe(400);
    expect(advance).not.toHaveBeenCalled();
    expect(sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  test.each(["confirmed", "cancelled", "preparing", "dispatched", "delivered"])(
    "%s does not need or forward Staff attribution", async (status) => {
      for (const staff of [{}, { staffId: "staff-17", staffName: "Ana Cruz" }]) {
        const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
          body: JSON.stringify({ status, ...staff, ...(status === "delivered" ? { deliveryPhotoFileId: "photo-1" } : {}) }),
          headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
          method: "POST",
        });
        expect((await post(request, context)).status).toBe(200);
        expect(advance).toHaveBeenLastCalledWith(12, { status, ...(status === "delivered" ? { deliveryPhotoFileId: "photo-1" } : {}) });
      }
    },
  );

  test("invites the Customer to leave Feedback when an Order is delivered", async () => {
    advance.mockResolvedValueOnce({ id: 12, status: "delivered", fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const deliveredRequest = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "delivered", deliveryPhotoFileId: "photo-1" }),
      headers: { "Authorization": `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await post(deliveredRequest, context)).status).toBe(200);
    expect(sendOrderDeliveredEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: 12, status: "delivered" }));
    expect(sendOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  test("refuses a missing, wrong, expired or retired credential with 401 before advancing the Order", async () => {
    const missing = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "confirmed" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const expired = mintCreomsCredential({ now: new Date(Date.now() - 600_000), lifetimeSeconds: 60 });

    expect((await post(missing, context)).status).toBe(401);
    expect((await post(statusRequest(mintCreomsCredential({ secret: "z".repeat(40) })), context)).status).toBe(401);
    expect((await post(statusRequest(expired), context)).status).toBe(401);
    process.env.ORDER_STATUS_API_SECRET = "test-secret";
    expect((await post(statusRequest("test-secret"), context)).status).toBe(401);
    delete process.env.ORDER_STATUS_API_SECRET;
    expect(advance).not.toHaveBeenCalled();
    expect(createOrderStore).not.toHaveBeenCalled();
  });

  test("can cancel an Order with a valid credential", async () => {
    advance.mockResolvedValueOnce({ id: 12, status: "cancelled", fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const cancel = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "cancelled" }),
      headers: { "Authorization": `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await post(cancel, context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "cancelled" });
  });
});

test("a failed Customer email lookup never reports a committed status change as failed", async () => {
  customerEmailForOrder.mockRejectedValueOnce(new Error("Customer lookup unavailable"));
  expect((await post(statusRequest(), context)).status).toBe(200);
});

describe("Customer Order events", () => {
  test.each(["confirmed", "cancelled"])("a committed %s change publishes one event for the Order's Customer", async (status) => {
    advance.mockResolvedValueOnce({ id: 12, status, fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await post(request, context)).status).toBe(200);
    expect(customerIdForOrder).toHaveBeenCalledWith(12);
    expect(publishCustomerOrderEvent).toHaveBeenCalledTimes(1);
    expect(publishCustomerOrderEvent).toHaveBeenCalledWith("customer-7", { type: "order.updated", orderId: "12" });
  });

  test("a refused, invalid or unauthorized change publishes nothing", async () => {
    const { OrderTransitionError } = await import("@/lib/orders/orders");
    advance.mockRejectedValueOnce(new OrderTransitionError("confirmed", "delivered"));
    expect((await post(statusRequest(), context)).status).toBe(409);
    advance.mockRejectedValueOnce(new Error("connection reset"));
    expect((await post(statusRequest(), context)).status).toBe(503);
    expect((await post(statusRequest("invalid"), context)).status).toBe(401);
    const invalid = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "shipped" }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });
    expect((await post(invalid, context)).status).toBe(400);
    expect(publishCustomerOrderEvent).not.toHaveBeenCalled();
  });

  test("a failed publish or Customer lookup is logged and never fails the committed change", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    publishCustomerOrderEvent.mockRejectedValueOnce(new Error("The gateway refused the Order event: 502"));
    const response = await post(statusRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 12, status: "confirmed" });
    expect(sendOrderConfirmedEmail).toHaveBeenCalled();

    customerIdForOrder.mockRejectedValueOnce(new Error("Customer lookup unavailable"));
    expect((await post(statusRequest(), context)).status).toBe(200);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "order.updated event for Order 12 could not be published",
      "order.updated event for Order 12 could not be published",
    ]);
    log.mockRestore();
  });
});
