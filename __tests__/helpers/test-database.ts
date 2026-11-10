import { readFile } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { inject } from "vitest";

let snapshot: Promise<Blob> | undefined;

/**
 * Returns a fresh, isolated, fully migrated in-memory Postgres (PGlite).
 * Loaded from the snapshot that `migrated-snapshot.ts` builds once per run, so
 * the caller owns it and must `close()` it. Restart watch mode after adding a
 * migration: the snapshot is built once at start.
 */
export async function createTestDatabase(): Promise<PGlite> {
  snapshot ??= readFile(inject("migratedSnapshotPath")).then((bytes) => new Blob([new Uint8Array(bytes)]));
  return new PGlite({ loadDataDir: await snapshot });
}
