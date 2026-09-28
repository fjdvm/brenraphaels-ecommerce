import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { customers, orders } from "../lib/db/schema";
import {
  OrderFeedbackAlreadySubmittedError,
  OrderFeedbackNotAvailableError,
  createOrderFeedbackStore,
} from "../lib/orders/feedback";

let client: PGlite;

beforeEach(async () => {
  client = new PGlite();
  const database = drizzle(client);
  await migrate(database, { migrationsFolder: "drizzle" });
  await database.insert(customers).values([
    { id: "customer-1", firstName: "Jane", lastName: "Doe", fullName: "Jane Doe", email: "jane@example.com", contactNumber: "09171234567", marketingOptIn: false },
    { id: "customer-2", firstName: "John", lastName: "Doe", fullName: "John Doe", email: "john@example.com", contactNumber: "09181234567", marketingOptIn: false },
  ]);
});

afterEach(async () => {
  await client.close();
});

async function createOrder(status: "confirmed" | "delivered", customerId = "customer-1") {
  const [order] = await drizzle(client).insert(orders).values({
    customerId,
    fulfillmentMethod: "pickup",
    paymentMethod: "cash-on-delivery",
    status,
    subtotalInCentavos: 21900,
  }).returning();
  return order;
}

describe("Order feedback", () => {
  test("stores one private Feedback for a delivered Order", async () => {
    const order = await createOrder("delivered");
    const feedback = await createOrderFeedbackStore(drizzle(client)).submit("customer-1", {
      orderId: order.id,
      rating: 5,
      comment: "The ube halaya arrived fresh and delicious.",
    });

    expect(feedback).toMatchObject({ orderId: order.id, rating: 5, comment: "The ube halaya arrived fresh and delicious." });
    await expect(createOrderFeedbackStore(drizzle(client)).forOrder("customer-1", order.id)).resolves.toMatchObject(feedback);
    await expect(createOrderFeedbackStore(drizzle(client)).forOrder("customer-2", order.id)).resolves.toBeUndefined();
  });

  test("rejects Feedback until the Customer's Order is delivered", async () => {
    const order = await createOrder("confirmed");

    await expect(createOrderFeedbackStore(drizzle(client)).submit("customer-1", {
      orderId: order.id,
      rating: 4,
      comment: "The ube halaya was delicious.",
    })).rejects.toBeInstanceOf(OrderFeedbackNotAvailableError);
  });

  test("enforces one Feedback per Order at the Postgres seam", async () => {
    const order = await createOrder("delivered");
    const store = createOrderFeedbackStore(drizzle(client));
    const input = { orderId: order.id, rating: 5, comment: "The ube halaya was delicious." };

    await store.submit("customer-1", input);
    await expect(store.submit("customer-1", input)).rejects.toBeInstanceOf(OrderFeedbackAlreadySubmittedError);
  });
});
