import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

const { advance, createOrderStore, getDatabase } = vi.hoisted(() => ({
  advance: vi.fn(),
  createOrderStore: vi.fn(() => ({ advance })),
  getDatabase: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ getDatabase }));
vi.mock("@/lib/orders/orders", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/orders/orders")>()),
  createOrderStore,
}));

let post: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response>;

beforeAll(async () => {
  ({ POST: post } = await import("../app/api/internal/orders/[id]/status/route"));
});

beforeEach(() => {
  process.env.ORDER_STATUS_API_SECRET = "test-secret";
  advance.mockReset().mockResolvedValue({ id: 12, status: "confirmed" });
  createOrderStore.mockClear();
  getDatabase.mockClear();
});

function statusRequest(secret?: string) {
  return new Request("https://shop.example.test/api/internal/orders/12/status", {
    body: JSON.stringify({ status: "confirmed", deliveryFeeInCentavos: 8000 }),
    headers: {
      "Authorization": `Bearer ${secret ?? "test-secret"}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

const context = { params: Promise.resolve({ id: "12" }) };

describe("POST /api/internal/orders/[id]/status", () => {
  test("accepts a request carrying the shared secret", async () => {
    expect((await post(statusRequest(), context)).status).toBe(200);
    expect(advance).toHaveBeenCalledWith(12, { status: "confirmed", deliveryFeeInCentavos: 8000 });
  });

  test("rejects a missing or invalid shared secret before advancing the Order", async () => {
    const missingSecret = new Request("https://shop.example.test/api/internal/orders/12/status", {
      body: JSON.stringify({ status: "confirmed" }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    expect((await post(missingSecret, context)).status).toBe(400);
    expect((await post(statusRequest("wrong-secret"), context)).status).toBe(400);
    expect(advance).not.toHaveBeenCalled();
  });
});
