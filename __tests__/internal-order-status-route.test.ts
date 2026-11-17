import { mintCreomsCredential } from "@/lib/orders/creoms-credential";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const {
  sendPackingAudit,
  afterTasks,
  advance,
  confirm,
  createOrderStore,
  customerEmailForOrder,
  customerIdForOrder,
  getDatabase,
  publishCustomerOrderEvent,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderDispatchedEmail,
  sendOrderPaidEmail,
  sendOnceAndRecord,
  sendOrderPickupConfirmedEmail,
} = vi.hoisted(() => ({
  sendPackingAudit: vi.fn(async () => {}),
  afterTasks: [] as Array<() => Promise<void>>,
  advance: vi.fn(),
  confirm: vi.fn(),
  createOrderStore: vi.fn(() => ({ advance, confirm, customerEmailForOrder, customerIdForOrder })),
  customerEmailForOrder: vi.fn(),
  customerIdForOrder: vi.fn(),
  getDatabase: vi.fn(),
  publishCustomerOrderEvent: vi.fn(),
  sendOrderConfirmedEmail: vi.fn(),
  sendOrderDeliveredEmail: vi.fn(),
  sendOrderDispatchedEmail: vi.fn(),
  sendOrderPaidEmail: vi.fn(),
  sendOnceAndRecord: vi.fn(async (_id: number, _kind: string, send: () => Promise<void>) => { await send(); return "sent"; }),
  sendOrderPickupConfirmedEmail: vi.fn(),
}));

vi.mock("@/lib/orders/stock-reservations", () => ({ createStockReservations: () => ({ sendPending: sendPackingAudit }) }));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { afterTasks.push(task); } }));
vi.mock("@/lib/notifications/outbox", () => ({ sendPendingCustomerNotifications: vi.fn() }));
vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/email/order-confirmed-email", () => ({ sendOrderConfirmedEmail }));
vi.mock("@/lib/email/order-delivered-email", () => ({ sendOrderDeliveredEmail }));
vi.mock("@/lib/email/order-dispatched-email", () => ({ sendOrderDispatchedEmail }));
vi.mock("@/lib/email/outcomes", () => ({ sendOnceAndRecord }));
vi.mock("@/lib/email/order-pickup-confirmed-email", () => ({ sendOrderPickupConfirmedEmail }));
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
  afterTasks.length = 0;
  sendPackingAudit.mockClear();
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
  confirm.mockReset().mockImplementation(async () => ({ order: await advance(), replayed: false }));
  customerEmailForOrder.mockReset().mockResolvedValue("jane@example.com");
  customerIdForOrder.mockReset().mockResolvedValue("customer-7");
  publishCustomerOrderEvent.mockReset().mockResolvedValue(undefined);
  sendOrderConfirmedEmail.mockReset().mockResolvedValue(undefined);
  sendOrderDeliveredEmail.mockReset().mockResolvedValue(undefined);
  sendOrderPaidEmail.mockReset().mockResolvedValue(undefined);
  sendOrderPickupConfirmedEmail.mockReset().mockResolvedValue(undefined);
  sendOnceAndRecord.mockClear();
  sendOrderDispatchedEmail.mockReset().mockResolvedValue(undefined);
  createOrderStore.mockClear();
  getDatabase.mockClear();
});

const confirmAmounts = { subtotalInCentavos: 21900, approvedDiscountInCentavos: 0, deliveryFeeInCentavos: 8000, totalInCentavos: 29900 };

function statusRequest(credential = mintCreomsCredential()) {
  return new Request("https://shop.example.test/api/internal/orders/12/status", {
    body: JSON.stringify({ status: "confirmed", ...confirmAmounts }),
    headers: {
      "Authorization": `Bearer ${credential}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

const context = { params: Promise.resolve({ id: "12" }) };

async function postAndNotify(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const response = await post(request, ctx);
  for (const task of afterTasks.splice(0)) await task();
  return response;
}

test("confirms the saved Delivery photo before waiting for Customer notifications", async () => {
  advance.mockResolvedValueOnce({
    id: 12, status: "delivered", deliveryPhotoFileId: "photo-1",
    fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900,
  });
  let releasePublish!: () => void;
  publishCustomerOrderEvent.mockImplementationOnce(() => new Promise<void>((resolve) => { releasePublish = resolve; }));
  const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
    body: JSON.stringify({ status: "delivered", deliveryPhotoFileId: "photo-1" }),
    headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
    method: "POST",
  });
  let response: Response | undefined;
  const pending = post(request, context).then((value) => { response = value; });
  try {
    await vi.waitFor(() => expect(response?.status).toBe(200), { timeout: 1_000 });
    expect(await response!.json()).toMatchObject({ id: 12, status: "delivered", deliveryPhotoFileId: "photo-1" });
    expect(advance).toHaveBeenCalledTimes(1);
    expect(publishCustomerOrderEvent).not.toHaveBeenCalled();
    expect(sendOrderDeliveredEmail).not.toHaveBeenCalled();
    const notifications = Promise.all(afterTasks.splice(0).map(task => task()));
    await vi.waitFor(() => expect(publishCustomerOrderEvent).toHaveBeenCalledTimes(1));
    releasePublish();
    await notifications;
    expect(sendOrderDeliveredEmail).toHaveBeenCalledTimes(1);
  } finally {
    releasePublish?.();
    await pending;
  }
});

describe("POST /api/internal/orders/[id]/status", () => {
  test("cancellation accepts legacy requests and forwards valid Staff attribution for stock release auditing", async () => {
    for (const staff of [{}, { staffId: "staff-17", staffName: "Ana Cruz" }]) {
      const response = await postAndNotify(new Request("https://shop.example.test/api/internal/orders/12/status", {
        body: JSON.stringify({ status: "cancelled", ...staff }),
        headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" }, method: "POST",
      }), context);
      expect(response.status).toBe(200);
      expect(advance).toHaveBeenLastCalledWith(12, { status: "cancelled", ...staff });
    }
  });

  test("accepts a request carrying a valid CREOMS service credential", async () => {
    expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
    expect(confirm).toHaveBeenCalledWith(12, confirmAmounts);
    expect(customerEmailForOrder).toHaveBeenCalledWith(12);
    expect(sendOrderConfirmedEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({
      id: 12,
      deliveryFeeInCentavos: 8000,
      subtotalInCentavos: 21900,
    }));
  });

  test("a confirmed COD Pickup Order gets its confirmation email once, through the outcome record", async () => {
    advance.mockResolvedValue({ id: 12, status: "confirmed", fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
    expect(sendOnceAndRecord).toHaveBeenCalledWith(12, "pickup-confirmed", expect.any(Function));
    expect(sendOrderPickupConfirmedEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: 12 }));
    expect(sendOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  test("a replayed confirm sends no Pickup email", async () => {
    advance.mockResolvedValue({ id: 12, status: "confirmed", fulfillmentMethod: "pickup", paymentMethod: "cash-on-delivery", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    confirm.mockImplementation(async () => ({ order: await advance(), replayed: true }));
    await postAndNotify(statusRequest(), context);
    expect(sendOrderPickupConfirmedEmail).not.toHaveBeenCalled();
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

    const response = await postAndNotify(request, context);
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
    expect((await postAndNotify(request, context)).status).toBe(400);
    expect(advance).not.toHaveBeenCalled();
    expect(sendOrderPaidEmail).not.toHaveBeenCalled();
  });

  test("requires packing Staff attribution and drains the durable audit after confirmation", async () => {
    for (const staff of [{}, { staffId: "ana" }, { staffId: "ana", staffName: "<script>" }]) {
      const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
        method: "POST", headers: { Authorization: `Bearer ${mintCreomsCredential()}` },
        body: JSON.stringify({ status: "preparing", ...staff }),
      });
      expect((await post(request, context)).status).toBe(400);
    }
    expect(advance).not.toHaveBeenCalled();
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      method: "POST", headers: { Authorization: `Bearer ${mintCreomsCredential()}` },
      body: JSON.stringify({ status: "preparing", staffId: "ana", staffName: "Ana" }),
    });
    expect((await postAndNotify(request, context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "preparing", staffId: "ana", staffName: "Ana" });
    expect(sendPackingAudit).toHaveBeenCalledOnce();
  });

  test("publishes the packed Order even when audit outbox delivery fails", async () => {
    sendPackingAudit.mockRejectedValueOnce(new Error("Audit outbox unavailable"));
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      method: "POST", headers: { Authorization: `Bearer ${mintCreomsCredential()}` },
      body: JSON.stringify({ status: "preparing", staffId: "ana", staffName: "Ana" }),
    });
    expect((await postAndNotify(request, context)).status).toBe(200);
    expect(publishCustomerOrderEvent).toHaveBeenCalledWith("customer-7", { type: "order.updated", orderId: "12" });
  });

  test.each(["dispatched", "delivered"])(
    "%s does not need or forward Staff attribution", async (status) => {
      for (const staff of [{}, { staffId: "staff-17", staffName: "Ana Cruz" }]) {
        const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
          body: JSON.stringify({ status, ...staff, ...(status === "delivered" ? { deliveryPhotoFileId: "photo-1" } : {}) }),
          headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
          method: "POST",
        });
        expect((await postAndNotify(request, context)).status).toBe(200);
        expect(advance).toHaveBeenLastCalledWith(12, { status, ...(status === "delivered" ? { deliveryPhotoFileId: "photo-1" } : {}) });
      }
    },
  );

  test("forwards the courier booking and emails the tracking link once on dispatch", async () => {
    const courier = { name: "Grab", trackingUrl: "https://grab.test/track/1", riderPhone: "0917 123 4567" };
    advance.mockResolvedValueOnce({ id: 12, status: "dispatched", fulfillmentMethod: "delivery", deliveryFeeInCentavos: 8000, subtotalInCentavos: 21900, courier });
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "dispatched", courier }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });
    expect((await postAndNotify(request, context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "dispatched", courier: expect.objectContaining({ name: "Grab", trackingUrl: courier.trackingUrl, riderPhone: "09171234567" }) });
    expect(sendOrderDispatchedEmail).toHaveBeenCalledTimes(1);
    expect(sendOrderDispatchedEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ courier }));
  });

  test("refuses an http courier link before any write", async () => {
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "dispatched", courier: { name: "Grab", trackingUrl: "http://grab.test/1" } }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });
    expect((await postAndNotify(request, context)).status).toBe(400);
    expect(advance).not.toHaveBeenCalled();
  });

  test("invites the Customer to leave Feedback when an Order is delivered", async () => {
    advance.mockResolvedValueOnce({ id: 12, status: "delivered", fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const deliveredRequest = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "delivered", deliveryPhotoFileId: "photo-1" }),
      headers: { "Authorization": `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await postAndNotify(deliveredRequest, context)).status).toBe(200);
    expect(sendOrderDeliveredEmail).toHaveBeenCalledWith("jane@example.com", expect.objectContaining({ id: 12, status: "delivered" }));
    expect(sendOrderConfirmedEmail).not.toHaveBeenCalled();
  });

  test("confirm needs all four amounts, and a mismatch is refused with its reason", async () => {
    const { OrderStatusUpdateError } = await import("@/lib/orders/orders");
    const send = (body: unknown) => postAndNotify(new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify(body), headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" }, method: "POST",
    }), context);
    expect((await send({ status: "confirmed", deliveryFeeInCentavos: 8000 })).status).toBe(400);
    expect((await send({ status: "confirmed", ...confirmAmounts, totalInCentavos: undefined })).status).toBe(400);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRejectedValueOnce(new OrderStatusUpdateError("The total does not match subtotal minus approved discount plus Delivery fee."));
    const refused = await send({ status: "confirmed", ...confirmAmounts, totalInCentavos: 1 });
    expect(refused.status).toBe(409);
    expect(await refused.json()).toEqual({ error: expect.stringContaining("total does not match") });
    expect(sendOrderConfirmedEmail).not.toHaveBeenCalled();
    expect(publishCustomerOrderEvent).not.toHaveBeenCalled();
  });

  test("repeating the same confirm answers with the Order and sends no second email", async () => {
    const order = { id: 12, status: "confirmed", fulfillmentMethod: "delivery", deliveryFeeInCentavos: 8000, subtotalInCentavos: 21900 };
    confirm.mockResolvedValueOnce({ order, replayed: false }).mockResolvedValueOnce({ order, replayed: true });
    expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
    expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
    expect(sendOrderConfirmedEmail).toHaveBeenCalledTimes(1);
  });

  test("refuses a missing, wrong, expired or retired credential with 401 before advancing the Order", async () => {
    const missing = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "confirmed" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const expired = mintCreomsCredential({ now: new Date(Date.now() - 600_000), lifetimeSeconds: 60 });

    expect((await postAndNotify(missing, context)).status).toBe(401);
    expect((await postAndNotify(statusRequest(mintCreomsCredential({ secret: "z".repeat(40) })), context)).status).toBe(401);
    expect((await postAndNotify(statusRequest(expired), context)).status).toBe(401);
    process.env.ORDER_STATUS_API_SECRET = "test-secret";
    expect((await postAndNotify(statusRequest("test-secret"), context)).status).toBe(401);
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

    expect((await postAndNotify(cancel, context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "cancelled" });
  });
});

test("a failed Customer email lookup never reports a committed status change as failed", async () => {
  customerEmailForOrder.mockRejectedValueOnce(new Error("Customer lookup unavailable"));
  expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
});

describe("Customer Order events", () => {
  test.each(["confirmed", "cancelled"])("a committed %s change publishes one event for the Order's Customer", async (status) => {
    advance.mockResolvedValueOnce({ id: 12, status, fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const request = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status, ...(status === "confirmed" ? { ...confirmAmounts, deliveryFeeInCentavos: null, totalInCentavos: 21900 } : {}) }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await postAndNotify(request, context)).status).toBe(200);
    expect(customerIdForOrder).toHaveBeenCalledWith(12);
    expect(publishCustomerOrderEvent).toHaveBeenCalledTimes(1);
    expect(publishCustomerOrderEvent).toHaveBeenCalledWith("customer-7", { type: "order.updated", orderId: "12" });
  });

  test("a refused, invalid or unauthorized change publishes nothing", async () => {
    const { OrderTransitionError } = await import("@/lib/orders/orders");
    confirm.mockRejectedValueOnce(new OrderTransitionError("confirmed", "delivered"));
    expect((await postAndNotify(statusRequest(), context)).status).toBe(409);
    confirm.mockRejectedValueOnce(new Error("connection reset"));
    expect((await postAndNotify(statusRequest(), context)).status).toBe(503);
    expect((await postAndNotify(statusRequest("invalid"), context)).status).toBe(401);
    const invalid = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "shipped" }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
      method: "POST",
    });
    expect((await postAndNotify(invalid, context)).status).toBe(400);
    expect(publishCustomerOrderEvent).not.toHaveBeenCalled();
  });

  test("a failed publish or Customer lookup is logged and never fails the committed change", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    publishCustomerOrderEvent.mockRejectedValueOnce(new Error("The gateway refused the Order event: 502"));
    const response = await postAndNotify(statusRequest(), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: 12, status: "confirmed" });
    expect(sendOrderConfirmedEmail).toHaveBeenCalled();

    customerIdForOrder.mockRejectedValueOnce(new Error("Customer lookup unavailable"));
    expect((await postAndNotify(statusRequest(), context)).status).toBe(200);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls.map(([message]) => message)).toEqual([
      "order.updated event for Order 12 could not be published",
      "order.updated event for Order 12 could not be published",
    ]);
    log.mockRestore();
  });
});

test("a committed status change signals Staff Orders independently of Customer delivery", async () => {
  publishCustomerOrderEvent.mockRejectedValueOnce(new Error("Customer channel unavailable"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const response = await postAndNotify(statusRequest(), context);
  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledWith("https://gateway.test/notifications/orders/changed", expect.objectContaining({
    method: "POST", body: "{}", headers: { Authorization: "Bearer storefront-key", "Content-Type": "application/json" },
  }));
  log.mockRestore();
});

describe("approved anyway on a paid update", () => {
  test("passes the Manager's reason to the store", async () => {
    advance.mockResolvedValue({ id: 12, status: "paid", fulfillmentMethod: "pickup", deliveryFeeInCentavos: null, subtotalInCentavos: 21900 });
    const response = await post(new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "paid", staffId: "s1", staffName: "Ana", approvedAnyway: { reason: "Seen in bank app" } }),
      headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" }, method: "POST",
    }), { params: Promise.resolve({ id: "12" }) });
    expect(response.status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, expect.objectContaining({ approvedAnyway: { reason: "Seen in bank app" } }));
  });
});
