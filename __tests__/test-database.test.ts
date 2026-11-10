import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, describe, expect, test } from "vitest";

import { customers } from "../lib/db/schema";
import { createTestDatabase } from "./helpers/test-database";

const open: PGlite[] = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((client) => client.close()));
});

async function tableNames(client: PGlite) {
  const result = await client.query<{ table_schema: string; table_name: string }>(
    `select table_schema, table_name from information_schema.tables
     where table_schema not in ('pg_catalog', 'information_schema') order by 1, 2`,
  );
  return result.rows.map((row) => `${row.table_schema}.${row.table_name}`);
}

describe("createTestDatabase", () => {
  test("two databases do not share rows", async () => {
    const first = await createTestDatabase();
    const second = await createTestDatabase();
    open.push(first, second);

    await drizzle(first).insert(customers).values({
      id: "customer-1",
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      email: "jane@example.com",
      contactNumber: "09171234567",
      marketingOptIn: false,
    });

    expect(await drizzle(first).select().from(customers)).toHaveLength(1);
    expect(await drizzle(second).select().from(customers)).toHaveLength(0);
  });

  test("its migrated table set matches a fresh run of the real migrations", async () => {
    const fresh = new PGlite();
    open.push(fresh);
    await migrate(drizzle(fresh), { migrationsFolder: "drizzle" });
    const snapshotted = await createTestDatabase();
    open.push(snapshotted);

    expect(await tableNames(snapshotted)).toEqual(await tableNames(fresh));
  });
});
