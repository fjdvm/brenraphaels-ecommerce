import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { mintCreomsCredential } from "@/lib/orders/creoms-credential";

const m = vi.hoisted(() => ({
  rejectPaymentProof: vi.fn(), customerEmailForOrder: vi.fn(), customerIdForOrder: vi.fn(),
  sendOnceAndRecord: vi.fn(async (_id: number, _kind: string, send: (email: { id: string }) => Promise<unknown>) => { await send({ id: "order-12-x" }); return "sent"; }),
  sendPaymentEmail: vi.fn(), after: [] as (() => Promise<void>)[],
}));
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { m.after.push(task); } }));
vi.mock("@/lib/db", () => ({ getDatabase: () => ({}) }));
vi.mock("@/lib/email/outcomes", () => ({ sendOnceAndRecord: m.sendOnceAndRecord }));
vi.mock("@/lib/email/payment-emails", () => ({ sendPaymentEmail: m.sendPaymentEmail }));
vi.mock("@/lib/notifications/outbox", () => ({ sendPendingCustomerNotifications: vi.fn() }));
vi.mock("@/lib/orders/live-events", () => ({ publishAfterCommit: vi.fn(), publishCustomerOrderEvent: vi.fn() }));
vi.mock("@/lib/orders/staff-signal", () => ({ scheduleOrdersChanged: vi.fn() }));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore: () => ({ rejectPaymentProof: m.rejectPaymentProof, customerEmailForOrder: m.customerEmailForOrder, customerIdForOrder: m.customerIdForOrder }),
}));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;
beforeAll(async () => { ({ POST: post } = await import("../app/api/internal/orders/[id]/payment-proof/reject/route")); });
beforeEach(() => {
  process.env.CREOMS_SERVICE_SECRET = "k".repeat(40);
  m.after.length = 0;
  m.rejectPaymentProof.mockReset(); m.sendPaymentEmail.mockReset().mockResolvedValue({});
  m.sendOnceAndRecord.mockClear(); m.customerEmailForOrder.mockReset().mockResolvedValue("jane@example.com");
});

async function reject() {
  const response = await post(new Request("https://shop.example.test/api/internal/orders/12/payment-proof/reject", {
    method: "POST", body: JSON.stringify({ reason: "Blurry", staffId: "s1", staffName: "Ana" }),
    headers: { Authorization: `Bearer ${mintCreomsCredential()}`, "Content-Type": "application/json" },
  }), { params: Promise.resolve({ id: "12" }) });
  for (const task of m.after) await task();
  return response;
}

describe("POST /api/internal/orders/:id/payment-proof/reject emails", () => {
  test("a normal rejection sends only Payment rejected, as its own occurrence", async () => {
    m.rejectPaymentProof.mockResolvedValue({ order: { id: 12 }, rejections: 2, managerReview: false });
    expect((await reject()).status).toBe(200);
    expect(m.sendOnceAndRecord).toHaveBeenCalledTimes(1);
    expect(m.sendOnceAndRecord).toHaveBeenCalledWith(12, "payment-rejected", expect.any(Function), expect.anything(), "2");
    expect(m.sendPaymentEmail).toHaveBeenCalledWith("payment-rejected", "jane@example.com", { id: 12 }, { id: "order-12-x" }, "2");
  });

  test("the third rejection sends only the Manager review email, never the normal rejection too", async () => {
    m.rejectPaymentProof.mockResolvedValue({ order: { id: 12 }, rejections: 3, managerReview: true });
    await reject();
    expect(m.sendOnceAndRecord).toHaveBeenCalledTimes(1);
    expect(m.sendOnceAndRecord).toHaveBeenCalledWith(12, "manager-review-started", expect.any(Function), expect.anything(), "");
    expect(m.sendPaymentEmail.mock.calls.map((call) => call[0])).toEqual(["manager-review-started"]);
  });

  test("a failing email never fails the saved rejection", async () => {
    m.rejectPaymentProof.mockResolvedValue({ order: { id: 12 }, rejections: 1, managerReview: false });
    m.sendOnceAndRecord.mockRejectedValueOnce(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await reject()).status).toBe(200);
  });
});
