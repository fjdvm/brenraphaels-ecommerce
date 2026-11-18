import { describe, expect, test } from "vitest";

import { formatPlacedAt, orderBadges, orderFilterOf, orderTrackerSteps, type OrderView } from "../lib/orders/order-view";

const base: OrderView = {
  fulfillmentMethod: "pickup",
  paymentMethod: "cash-on-delivery",
  status: "placed",
  deliveryFeeInCentavos: null,
  paymentProof: null,
};
const order = (overrides: Partial<OrderView>): OrderView => ({ ...base, ...overrides });

describe("orderTrackerSteps", () => {
  test("names the pickup steps and marks the current one", () => {
    const steps = orderTrackerSteps(order({ status: "confirmed" }));
    expect(steps?.map((step) => step.label)).toEqual(["Placed", "Confirmed", "Preparing", "Ready for pickup", "Completed"]);
    expect(steps?.map((step) => step.state)).toEqual(["done", "current", "upcoming", "upcoming", "upcoming"]);
  });

  test("names the delivery steps", () => {
    const steps = orderTrackerSteps(order({ fulfillmentMethod: "delivery", status: "dispatched" }));
    expect(steps?.map((step) => step.label)).toEqual(["Placed", "Confirmed", "Preparing", "Out for delivery", "Completed"]);
    expect(steps?.[3].state).toBe("current");
  });

  test("treats payment statuses as Confirmed", () => {
    for (const status of ["awaiting payment", "paid"] as const) {
      expect(orderTrackerSteps(order({ status }))?.[1].state).toBe("current");
    }
  });

  test("completes every step once delivered", () => {
    expect(orderTrackerSteps(order({ status: "delivered" }))?.every((step) => step.state === "done")).toBe(true);
  });

  test("has no tracker for a cancelled Order", () => {
    expect(orderTrackerSteps(order({ status: "cancelled" }))).toBeNull();
  });
});

describe("orderFilterOf", () => {
  test.each([
    [{ status: "placed" }, "processing"],
    [{ status: "preparing" }, "processing"],
    [{ status: "awaiting payment", paymentMethod: "gcash" }, "processing"],
    [{ status: "confirmed", paymentMethod: "gcash" }, "to-pay"],
    [{ status: "dispatched" }, "on-the-way"],
    [{ status: "delivered" }, "completed"],
    [{ status: "cancelled" }, "cancelled"],
  ] as const)("files %j under %s", (overrides, filter) => {
    expect(orderFilterOf(order(overrides))).toBe(filter);
  });

  test("a GCash Order that already has proof is not waiting on payment", () => {
    const proof = { gcashReferenceNumber: "1", screenshotPathname: null, screenshotFileId: null, submittedAt: new Date() };
    expect(orderFilterOf(order({ status: "confirmed", paymentMethod: "gcash", paymentProof: proof }))).toBe("processing");
  });
});

describe("orderBadges", () => {
  test("shows the status plus what the Customer still has to do", () => {
    expect(orderBadges(order({ status: "confirmed", paymentMethod: "gcash" }))).toEqual([
      { text: "Confirmed", tone: "lavender" },
      { text: "Payment needed", tone: "warning" },
    ]);
  });

  test("flags a Delivery Order whose fee is still being quoted", () => {
    expect(orderBadges(order({ fulfillmentMethod: "delivery" }))).toEqual([
      { text: "Placed", tone: "neutral" },
      { text: "Delivery fee pending", tone: "warning" },
    ]);
  });

  test("a proof waiting for Staff shows Pending Verification", () => {
    expect(orderBadges(order({ status: "awaiting payment", paymentMethod: "gcash", paymentProof: { gcashReferenceNumber: "1", screenshotPathname: null, screenshotFileId: null, submittedAt: new Date() } }))[0].text).toBe("Pending Verification");
  });
});

describe("formatPlacedAt", () => {
  test("reads in the shop's time zone", () => {
    expect(formatPlacedAt(new Date("2026-10-16T06:14:00Z"))).toBe("Oct 16, 2026 · 2:14 PM");
  });
});
