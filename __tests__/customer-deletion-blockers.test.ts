import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { findDeletionBlockers } from "../lib/customer/deletion";
import { createTestDatabase } from "./helpers/test-database";

let client: PGlite;

beforeEach(async () => {
  client = await createTestDatabase();
  await client.query(
    `insert into customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in) values ('c1', 'Jane', 'Doe', 'Jane Doe', 'jane@example.com', '09171234567', false), ('c2', 'John', 'Doe', 'John Doe', 'john@example.com', '09181112222', false)`,
  );
});

afterEach(async () => {
  await client.close();
});

const order = async (status: string, customer = "c1") =>
  (await client.query<{ id: number }>(
    `insert into orders (customer_id, fulfillment_method, payment_method, status, subtotal_in_centavos) values ($1, 'delivery', 'gcash', $2, 1000) returning id`,
    [customer, status],
  )).rows[0].id;
const ticket = async (status: string, customer = "c1") =>
  (await client.query<{ id: number }>(
    `insert into tickets (customer_id, subject, category, status) values ($1, 'Help', 'order', $2) returning id`,
    [customer, status],
  )).rows[0].id;
const orderReturn = async (orderId: number, status: string) =>
  (await client.query<{ id: number }>(
    `insert into order_returns (order_id, status, reason, amount_in_centavos) values ($1, $2, 'damaged', 500) returning id`,
    [orderId, status],
  )).rows[0].id;
const blockers = () => findDeletionBlockers("c1", drizzle(client));

describe("Deletion blockers", () => {
  test("a Customer with no work in flight has none", async () => {
    await order("delivered");
    await order("cancelled");
    await ticket("resolved");
    expect(await blockers()).toEqual([]);
  });

  test.each(["placed", "confirmed", "awaiting payment", "paid", "preparing", "dispatched"])(
    "an Order that is %s blocks and is named",
    async (status) => {
      const id = await order(status);
      expect(await blockers()).toEqual([{ kind: "order", id, status }]);
    },
  );

  test.each(["delivered", "received", "cancelled"])("an Order that is %s does not block", async (status) => {
    await order(status);
    expect(await blockers()).toEqual([]);
  });

  test.each(["requested", "approved"])("a Return that is %s blocks and is named", async (status) => {
    const id = await orderReturn(await order("delivered"), status);
    expect(await blockers()).toEqual([{ kind: "return", id, status }]);
  });

  test.each(["goods received", "refunded", "replaced", "declined", "cancelled"])(
    "a Return that is %s does not block",
    async (status) => {
      await orderReturn(await order("delivered"), status);
      expect(await blockers()).toEqual([]);
    },
  );

  test.each(["open", "on_hold"])("a Ticket that is %s blocks and is named", async (status) => {
    const id = await ticket(status);
    expect(await blockers()).toEqual([{ kind: "ticket", id, status }]);
  });

  test.each(["resolved", "completed"])("a Ticket that is %s does not block", async (status) => {
    await ticket(status);
    expect(await blockers()).toEqual([]);
  });

  test("lists every blocker and ignores other Customers", async () => {
    const o = await order("placed");
    const t = await ticket("open");
    const r = await orderReturn(await order("delivered"), "requested");
    await order("placed", "c2");
    await ticket("open", "c2");
    expect(await blockers()).toEqual([
      { kind: "order", id: o, status: "placed" },
      { kind: "return", id: r, status: "requested" },
      { kind: "ticket", id: t, status: "open" },
    ]);
  });
});
