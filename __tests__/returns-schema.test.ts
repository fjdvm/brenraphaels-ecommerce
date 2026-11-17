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
    await client.query("INSERT INTO customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in) VALUES ('c1', 'Maria', 'Santos', 'Maria Santos', 'maria@example.com', '09171234567', false)");
    // Raw SQL: the baseline predates columns the current schema lists.
    const { rows: [order] } = await client.query<{ id: number }>("INSERT INTO orders (customer_id, status, fulfillment_method, payment_method, subtotal_in_centavos) VALUES ('c1', 'delivered', 'delivery', 'cash-on-delivery', 10000) RETURNING id");
    const [line] = await database.insert(orderLines).values({ orderId: order.id, productName: "Halaya", sizeLabel: "Small",
      quantity: 2, priceInCentavos: 5000 }).returning();

    await migrate(database, { migrationsFolder: "drizzle" });
    const [created] = await database.insert(orderReturns).values({ orderId: order.id, reason: "damaged", amountInCentavos: 10000 }).returning();
    expect(created).toMatchObject({ status: "requested", preferredResolution: "refund", finalResolution: null, videoFileId: null, refundProofFileId: null, replacedAt: null, goodsRequired: null, declineReason: null, refundedAt: null });
    await database.insert(orderReturnItems).values({ returnId: created.id, orderLineId: line.id, productName: "Halaya",
      sizeLabel: "Small", quantity: 2, priceInCentavos: 5000 });
    await database.insert(orderReturnImages).values({ returnId: created.id, position: 1, fileId: "private-defect" });
    const at = new Date("2026-10-23T08:00:00Z");
    await database.insert(orderReturnHistory).values({ returnId: created.id, status: "approved", actorType: "staff",
      actorId: "ana", actorName: "Ana Reyes", occurredAt: at });
    await migrate(database, { migrationsFolder: "drizzle" });

    expect((await database.select().from(orders)).map(({ id }) => id)).toEqual([order.id]);
    expect(await database.select().from(orderLines)).toEqual([line]);
    expect(await database.select().from(orderReturns).orderBy(orderReturns.id)).toEqual([created]);
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

test("Resolution migration preserves legacy refund Returns and round-trips replacement evidence and proof", async () => {
  const client = new PGlite();
  const baseline = mkdtempSync(join(tmpdir(), "returns-resolution-baseline-"));
  try {
    cpSync("drizzle", baseline, { recursive: true });
    const journal = JSON.parse(readFileSync(join(baseline, "meta/_journal.json"), "utf8"));
    journal.entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 20);
    writeFileSync(join(baseline, "meta/_journal.json"), JSON.stringify(journal));
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: baseline });
    await client.query("INSERT INTO customers (id, first_name, last_name, full_name, email, contact_number, marketing_opt_in) VALUES ('c1', 'Maria', 'Santos', 'Maria Santos', 'maria@example.com', '09171234567', false)");
    // Raw SQL: the baseline predates columns the current schema lists.
    const { rows: [order] } = await client.query<{ id: number }>("INSERT INTO orders (customer_id, status, fulfillment_method, payment_method, subtotal_in_centavos) VALUES ('c1', 'delivered', 'pickup', 'cash-on-delivery', 10000) RETURNING id");
    // Exercise the pre-0020 schema, which has no Resolution columns yet.
    await client.query("INSERT INTO order_returns (order_id, status, reason, amount_in_centavos, goods_required) VALUES ($1, 'approved', 'damaged', 10000, false), ($1, 'refunded', 'defective', 10000, false), ($1, 'requested', 'other', 10000, null)", [order.id]);
    await client.exec("INSERT INTO order_return_history (return_id, status, actor_type, actor_id, actor_name, occurred_at) VALUES (1, 'approved', 'staff', 'ana', 'Ana Reyes', '2026-10-23T08:00:00Z')");
    await migrate(database, { migrationsFolder: "drizzle" });
    expect(await database.select().from(orderReturns).orderBy(orderReturns.id)).toMatchObject([
      { id: 1, status: "approved", preferredResolution: "refund", finalResolution: "refund", goodsRequired: false },
      { id: 2, status: "refunded", preferredResolution: "refund", finalResolution: "refund", refundProofFileId: null },
      { id: 3, status: "requested", preferredResolution: "refund", finalResolution: null },
    ]);
    expect(await database.select().from(orderReturnHistory)).toMatchObject([{ actorId: "ana", status: "approved" }]);
    const [replacement] = await database.insert(orderReturns).values({ orderId: order.id, reason: "wrong item", amountInCentavos: 10000,
      preferredResolution: "replacement", finalResolution: "replacement", videoFileId: "private-video", status: "replaced",
      replacedAt: new Date("2026-10-24T08:00:00Z") }).returning();
    const [refund] = await database.insert(orderReturns).values({ orderId: order.id, reason: "defective", amountInCentavos: 10000,
      finalResolution: "refund", status: "refunded", refundProofFileId: "private-proof", refundedAt: new Date("2026-10-24T08:00:00Z") }).returning();
    await migrate(database, { migrationsFolder: "drizzle" });
    expect((await database.select().from(orderReturns).orderBy(orderReturns.id)).slice(3)).toEqual([replacement, refund]);
    await expect(client.query("UPDATE order_returns SET preferred_resolution = 'credit' WHERE id = $1", [replacement.id])).rejects.toThrow();
    await expect(client.query("UPDATE order_returns SET final_resolution = 'credit' WHERE id = $1", [replacement.id])).rejects.toThrow();
    await expect(client.query("UPDATE order_returns SET status = 'unknown' WHERE id = $1", [replacement.id])).rejects.toThrow();
    await expect(client.exec("UPDATE order_return_history SET status = 'unknown'")).rejects.toThrow();
  } finally {
    await client.close();
    rmSync(baseline, { recursive: true, force: true });
  }
});
