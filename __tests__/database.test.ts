import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, expect, test } from "vitest";

let client: PGlite | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

test("applies Drizzle migrations to an in-memory Postgres database", async () => {
  client = new PGlite();
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  const result = await client.query<{ key: string }>(
    "select key from app_metadata",
  );
  expect(result.rows).toEqual([]);
});
