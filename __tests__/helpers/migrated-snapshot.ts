import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    migratedSnapshotPath: string;
  }
}

/**
 * Vitest globalSetup: runs every Drizzle migration once per test run, saves the
 * migrated database to the OS temp directory and shares its path with tests.
 * Rebuilt on every run and never committed; `createTestDatabase()` loads it.
 */
export default async function setup(project: TestProject) {
  const directory = await mkdtemp(join(tmpdir(), "brenraphaels-test-db-"));
  const snapshotPath = join(directory, "migrated.tar");

  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  const dump = await client.dumpDataDir("none");
  await client.close();
  await writeFile(snapshotPath, Buffer.from(await dump.arrayBuffer()));

  project.provide("migratedSnapshotPath", snapshotPath);

  return () => rm(directory, { recursive: true, force: true });
}
