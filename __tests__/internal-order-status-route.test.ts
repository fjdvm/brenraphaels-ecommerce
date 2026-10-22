import { mintCreomsCredential } from "@/lib/orders/creoms-credential";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const {
  advance,
  createOrderStore,
  customerEmailForOrder,
  getDatabase,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderPaidEmail,
} = vi.hoisted(() => ({
  advance: vi.fn(),
  createOrderStore: vi.fn(() => ({ advance, customerEmailForOrder })),
  customerEmailForOrder: vi.fn(),
  getDatabase: vi.fn(),
  sendOrderConfirmedEmail: vi.fn(),
  sendOrderDeliveredEmail: vi.fn(),
  sendOrderPaidEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/email/order-confirmed-email", () => ({ sendOrderConfirmedEmail }));
vi.mock("@/lib/email/order-delivered-email", () => ({ sendOrderDeliveredEmail }));
vi.mock("@/lib/email/order-paid-email", () => ({ sendOrderPaidEmail }));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore,
}));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeAll(async () => {
  ({ POST: post } = await import("../app/api/internal/orders/[id]/status/route"));
});

beforeEach(() => {
  process.env.CREOMS_SERVICE_SECRET = "k".repeat(40);
  advance.mockReset().mockResolvedValue({
    id: 12,
    status: "confirmed",
    fulfillmentMethod: "delivery",
    deliveryFeeInCentavos: 8000,
    subtotalInCentavos: 21900,
  });
  customerEmailForOrder.mockReset().mockResolvedValue("jane@example.com");
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
          body: JSON.stringify({ status, ...staff }),
          headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
          method: "POST",
        });
        expect((await post(request, context)).status).toBe(200);
        expect(advance).toHaveBeenLastCalledWith(12, { status });
      }
    },
  );

  test("invites the Customer to leave Feedback when an Order is delivered", async () => {
    advance.mockResolvedValueOnce({ id: 12, status: "delivered", fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const deliveredRequest = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "delivered" }),
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
