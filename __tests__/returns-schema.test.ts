import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { expect, test } from "vitest";

import { customers, orders, orderLines, orderReturns, orderReturnItems, orderReturnImages, orderReturnHistory } from "../lib/db/schema";

test("Returns migrate over existing Orders, retain their data and can be migrated again", async () => {
  const client = new PGlite();
  const baseline = mkdtempSync(join(tmpdir(), "returns-schema-baseline-"));
  try {
    cpSync("drizzle", baseline, { recursive: true });
    const journal = JSON.parse(readFileSync(join(baseline, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 19);
    writeFileSync(join(baseline, "meta/_journal.json"), JSON.stringify(journal));
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: baseline });
    await database.insert(customers).values({ id: "c1", firstName: "Maria", lastName: "Santos", fullName: "Maria Santos",
      email: "maria@example.com", contactNumber: "09171234567", marketingOptIn: false });
    const [order] = await database.insert(orders).values({ customerId: "c1", status: "delivered", fulfillmentMethod: "delivery",
      paymentMethod: "cash-on-delivery", subtotalInCentavos: 10000 }).returning();
    const [line] = await database.insert(orderLines).values({ orderId: order.id, productName: "Halaya", sizeLabel: "Small",
      quantity: 2, priceInCentavos: 5000 }).returning();

    await migrate(database, { migrationsFolder: "drizzle" });
    const [created] = await database.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: 10000 }).returning();
    expect(created).toMatchObject({ status: "requested", goodsRequired: null, declineReason: null, refundedAt: null });
    await database.insert(orderReturnItems).values({ returnId: created.id, orderLineId: line.id, productName: "Halaya",
      sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 });
    await database.insert(orderReturnImages).values({ returnId: created.id, position: 1, fileId: "private-defect" });
    const at = new Date("2026-10-23T08:00:00Z");
    await database.insert(orderReturnHistory).values({ returnId: created.id, status: "approved", actorType: "staff",
      actorId: "ana", actorName: "Ana Reyes", occurredAt: at });
    await migrate(database, { migrationsFolder: "drizzle" });

    expect(await database.select().from(orders)).toEqual([order]);
    expect(await database.select().from(orderLines)).toEqual([line]);
    expect(await database.select().from(orderReturns)).toEqual([created]);
    expect(await database.select().from(orderReturnItems)).toMatchObject([{ productName: "Halaya", quantity: 2, priceInCentavos: 5000 }]);
    expect(await database.select().from(orderReturnImages)).toMatchObject([{ position: 1, fileId: "private-defect" }]);
    expect(await database.select().from(orderReturnHistory)).toMatchObject([{ actorId: "ana", actorName: "Ana Reyes", occurredAt: at }]);
    await expect(database.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: -1 }))
      .rejects.toThrow();
    await expect(database.insert(orderReturnImages).values({ returnId: created.id, position: 4, fileId: "fourth" }))
      .rejects.toThrow();
  } finally {
    await client.close();
    rmSync(baseline, { recursive: true, force: true });
  }
});
