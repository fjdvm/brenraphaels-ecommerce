import { describe, expect, test } from "vitest";

import { deriveNotifications } from "../lib/notifications/derive";
import { formatClock, formatDayAndClock, relativeTime } from "../lib/notifications/relative-time";
import type { Order } from "../lib/orders/orders";
import type { Ticket } from "../lib/support/tickets";

const now = new Date("2026-10-19T12:00:00Z");

const order = (overrides: Partial<Order>): Order => ({
  id: 7,
  fulfillmentMethod: "pickup",
  paymentMethod: "cash-on-delivery",
  status: "placed",
  subtotalInCentavos: 20_900,
  deliveryFeeInCentavos: null,
  createdAt: new Date("2026-10-16T06:14:00Z"),
  lines: [],
  deliveryAddress: null,
  paymentProof: null,
  paidById: null,
  paidByName: null,
  paidAt: null,
  deliveryPhotoFileId: null,
  ...overrides,
});

const ticket = (overrides: Partial<Ticket>): Ticket => ({
  id: 5,
  subject: "Payment not reflecting",
  category: "Payment Issue",
  orderId: 7,
  status: "open",
  createdAt: new Date("2026-10-19T11:00:00Z"),
  messages: [],
  ...overrides,
});

describe("deriveNotifications", () => {
  test("announces an unanswered staff reply and links to the conversation", () => {
    const [reply] = deriveNotifications({
      orders: [],
      tickets: [
        ticket({
          messages: [
            { id: 1, sender: "customer", body: "Done!", attachmentPathname: null, fileId: null, createdAt: new Date("2026-10-19T11:30:00Z") },
            { id: 2, sender: "staff", body: "Got it!", attachmentPathname: null, fileId: null, createdAt: new Date("2026-10-19T11:58:00Z") },
          ],
        }),
      ],
    });
    expect(reply).toMatchObject({ category: "support", needsAction: true, href: "/support/5", actionLabel: "Open conversation" });
    expect(reply.body).toBe("“Got it!”");
  });

  test("ignores a thread the Customer answered last or that is closed", () => {
    const customerLast = ticket({ messages: [{ id: 1, sender: "customer", body: "Hi", attachmentPathname: null, fileId: null, createdAt: now }] });
    const closed = ticket({ status: "closed", messages: [{ id: 2, sender: "staff", body: "Done", attachmentPathname: null, fileId: null, createdAt: now }] });
    expect(deriveNotifications({ orders: [], tickets: [customerLast, closed] })).toEqual([]);
  });

  test("asks for payment on a confirmed GCash Order and also reports its status", () => {
    const items = deriveNotifications({ orders: [order({ status: "confirmed", paymentMethod: "gcash" })], tickets: [] });
    expect(items.map((item) => item.title)).toEqual(["Payment needed for Order #7", "Order #7 confirmed"]);
    expect(items[0]).toMatchObject({ needsAction: true, actionLabel: "Pay now", category: "orders" });
    expect(items[1].needsAction).toBe(false);
  });

  test("reports a pending delivery fee instead of the plain status", () => {
    const items = deriveNotifications({ orders: [order({ id: 4, fulfillmentMethod: "delivery" })], tickets: [] });
    expect(items.map((item) => item.title)).toEqual(["Delivery fee pending · Order #4"]);
  });

  test("words a dispatched Order by how it is fulfilled", () => {
    const pickup = deriveNotifications({ orders: [order({ status: "dispatched" })], tickets: [] })[0];
    const delivery = deriveNotifications({ orders: [order({ status: "dispatched", fulfillmentMethod: "delivery", deliveryFeeInCentavos: 5_000 })], tickets: [] })[0];
    expect(pickup.title).toBe("Order #7 is ready for pickup");
    expect(delivery.title).toBe("Order #7 is on the way");
  });

  test("lists the newest first", () => {
    const items = deriveNotifications({
      orders: [order({ id: 1, createdAt: new Date("2026-10-01T00:00:00Z") }), order({ id: 2, createdAt: new Date("2026-10-10T00:00:00Z") })],
      tickets: [],
    });
    expect(items.map((item) => item.id)).toEqual(["order-2-status", "order-1-status"]);
  });
});

describe("relativeTime", () => {
  test.each([
    ["2026-10-19T11:58:00Z", "2m ago"],
    ["2026-10-19T11:00:00Z", "1h ago"],
    ["2026-10-19T11:59:50Z", "Just now"],
    ["2026-10-16T06:14:00Z", "Oct 16"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(new Date(iso), now)).toBe(expected);
  });
});

describe("formatClock", () => {
  test("reads in the shop's time zone", () => {
    expect(formatClock(new Date("2026-10-16T06:14:00Z"))).toBe("2:14 PM");
  });
});

describe("formatDayAndClock", () => {
  test("reads in the shop's time zone", () => {
    expect(formatDayAndClock(new Date("2026-10-16T06:20:00Z"))).toBe("Oct 16, 2:20 PM");
  });
});
