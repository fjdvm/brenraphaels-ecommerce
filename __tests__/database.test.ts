import { PGlite } from "@electric-sql/pglite";
import { afterEach, expect, test } from "vitest";

import { createTestDatabase } from "./helpers/test-database";

let client: PGlite | undefined;

afterEach(async () => {
  await client?.close();
  client = undefined;
});

test("applies Drizzle migrations to an in-memory Postgres database", async () => {
  client = await createTestDatabase();
  const result = await client.query<{ key: string }>(
    "select key from app_metadata",
  );
  expect(result.rows).toEqual([]);
});
