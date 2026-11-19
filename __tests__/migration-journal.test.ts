import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const drizzleDir = join(process.cwd(), "drizzle");
const journal: { entries: { idx: number; when: number; tag: string }[] } = JSON.parse(
  readFileSync(join(drizzleDir, "meta", "_journal.json"), "utf8"),
);

// Drizzle's migrator applies only migrations whose `when` is newer than the latest one already applied.
// An entry older than its predecessor is silently skipped on every database that is already past it
// (0049 was, which left production without `order_delivery_addresses.region`). 0049 and 0058 are
// 0049 is repaired by 0062 (0058 is already live in production); no new entry may go out of order.
const knownOutOfOrder = new Set(["0049_address_region", "0058_order_cod_collection"]);

describe("migration journal", () => {
  it("never adds an entry older than the one before it", () => {
    let newest = -1;
    const outOfOrder: string[] = [];
    for (const entry of journal.entries) {
      if (entry.when <= newest && !knownOutOfOrder.has(entry.tag)) outOfOrder.push(entry.tag);
      newest = Math.max(newest, entry.when);
    }
    expect(outOfOrder).toEqual([]);
  });

  it("has a SQL file for every entry and an entry for every SQL file", () => {
    const sqlTags = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql")).map((f) => f.replace(/\.sql$/, "")).sort();
    expect(journal.entries.map((e) => e.tag).sort()).toEqual(sqlTags);
  });

  it("repairs the address region columns idempotently", () => {
    const repair = readFileSync(join(drizzleDir, "0062_repair_address_region.sql"), "utf8");
    expect(repair).toContain('ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "region" text');
    expect(repair).toContain('ALTER TABLE "order_delivery_addresses" ADD COLUMN IF NOT EXISTS "region" text');
  });
});
