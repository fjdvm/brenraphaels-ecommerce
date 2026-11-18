import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { mintCreomsCredential } from "@/lib/orders/creoms-credential";

const { afterTasks, updateCourier, customerIdForOrder, publishCustomerOrderEvent, sendOrderDispatchedEmail, scheduleOrdersChanged } = vi.hoisted(() => ({
  afterTasks: [] as Array<() => Promise<void>>,
  updateCourier: vi.fn(),
  customerIdForOrder: vi.fn(),
  publishCustomerOrderEvent: vi.fn(),
  sendOrderDispatchedEmail: vi.fn(),
  scheduleOrdersChanged: vi.fn(),
}));

vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { afterTasks.push(task); } }));
vi.mock("@/lib/db", () => ({ getDatabase: vi.fn() }));
vi.mock("@/lib/email/fulfilment-emails", () => ({ sendFulfilmentEmail: sendOrderDispatchedEmail }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged }));
vi.mock("@/lib/orders/live-events", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/orders/live-events")>()), publishCustomerOrderEvent }));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore: () => ({ updateCourier, customerIdForOrder }),
}));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => { ({ POST: post } = await import("../app/api/internal/orders/[id]/courier/route")); });
afterEach(() => { vi.unstubAllEnvs(); });
beforeEach(() => {
  afterTasks.length = 0;
  process.env.CREOMS_SERVICE_SECRET = "k".repeat(40);
  updateCourier.mockReset().mockResolvedValue({ id: 12, status: "dispatched", deliveryFeeInCentavos: 8000, courier: { name: "Grab", trackingUrl: "https://grab.test/1" } });
  customerIdForOrder.mockReset().mockResolvedValue("customer-7");
  publishCustomerOrderEvent.mockReset().mockResolvedValue(undefined);
  sendOrderDispatchedEmail.mockReset();
  scheduleOrdersChanged.mockReset();
});

const staff = { staffId: "staff-17", staffName: "Ana Cruz" };
const request = (body: unknown, credential: string | null = mintCreomsCredential()) => new Request("https://shop.example.test/api/internal/orders/12/courier", {
  method: "POST", body: JSON.stringify(body),
  headers: { "Content-Type": "application/json", ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
});
const context = { params: Promise.resolve({ id: "12" }) };
async function send(req: Request, ctx = context) {
  const response = await post(req, ctx);
  for (const task of afterTasks.splice(0)) await task();
  return response;
}

describe("changing a dispatched Order's booking", () => {
  test("saves the whole booking, tells the Customer's page live, signals Staff, and never emails again or returns rider details", async () => {
    updateCourier.mockResolvedValueOnce({ id: 12, status: "dispatched", deliveryFeeInCentavos: 8000, courier: { name: "Grab", trackingUrl: "https://grab.test/1" } });
    const response = await send(request({ courier: { name: "Grab", trackingUrl: "https://grab.test/1", riderName: "Juan", riderPhone: "0917 123 4567" }, ...staff }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 12, status: "dispatched", courier: { name: "Grab", trackingUrl: "https://grab.test/1" }, deliveryFeeInCentavos: 8000 });
    expect(updateCourier).toHaveBeenCalledWith(12, expect.objectContaining({ name: "Grab", riderName: "Juan", riderPhone: "09171234567" }));
    expect(publishCustomerOrderEvent).toHaveBeenCalledWith("customer-7", { type: "order.updated", orderId: "12" });
    expect(scheduleOrdersChanged).toHaveBeenCalledTimes(1);
    expect(sendOrderDispatchedEmail).not.toHaveBeenCalled();
  });

  test("accepts a courier with no link, and answers a null link", async () => {
    updateCourier.mockResolvedValueOnce({ id: 12, status: "dispatched", deliveryFeeInCentavos: null, courier: { name: "Grab", trackingUrl: null } });
    const response = await send(request({ courier: { name: "Grab" }, ...staff }));
    expect((await response.json()).courier).toEqual({ name: "Grab", trackingUrl: null });
    expect(updateCourier).toHaveBeenCalledWith(12, { name: "Grab" });
  });

  test("refuses a missing or wrong credential before touching the Order", async () => {
    expect((await send(request({ courier: { name: "Grab" }, ...staff }, null))).status).toBe(401);
    expect((await send(request({ courier: { name: "Grab" }, ...staff }, mintCreomsCredential({ secret: "z".repeat(40) })))).status).toBe(401);
    expect(updateCourier).not.toHaveBeenCalled();
  });

  test.each([
    ["an http link", { courier: { name: "Grab", trackingUrl: "http://grab.test/1" }, ...staff }],
    ["an unknown courier", { courier: { name: "Other" }, ...staff }],
    ["no Staff attribution", { courier: { name: "Grab" } }],
    ["unexpected fields", { courier: { name: "Grab" }, status: "delivered", ...staff }],
  ])("refuses %s with 400 before any write", async (_label, body) => {
    expect((await send(request(body))).status).toBe(400);
    expect(updateCourier).not.toHaveBeenCalled();
  });

  test("refuses a bad Order id, and passes on the store's refusals", async () => {
    expect((await send(request({ courier: { name: "Grab" }, ...staff }), { params: Promise.resolve({ id: "abc" }) })).status).toBe(400);
    const { OrderStatusUpdateError } = await import("@/lib/orders/orders");
    updateCourier.mockRejectedValueOnce(new OrderStatusUpdateError("The booking can only be changed while the Order is dispatched. Refresh the Order."));
    const refused = await send(request({ courier: { name: "Grab" }, ...staff }));
    expect(refused.status).toBe(409);
    expect((await refused.json()).error).toContain("dispatched");
    updateCourier.mockRejectedValueOnce(new OrderStatusUpdateError("Order was not found."));
    expect((await send(request({ courier: { name: "Grab" }, ...staff }))).status).toBe(404);
    updateCourier.mockRejectedValueOnce(new Error("db down"));
    expect((await send(request({ courier: { name: "Grab" }, ...staff }))).status).toBe(503);
    expect(scheduleOrdersChanged).not.toHaveBeenCalled();
  });
});
