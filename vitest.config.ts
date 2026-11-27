import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the "@/*" path alias in tsconfig.json.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Inlined so tests can mock the next/headers import inside the Neon Auth SDK.
    server: { deps: { inline: ["@neondatabase/auth"] } },
    // Migrates once per run and snapshots the database for createTestDatabase().
    setupFiles: ["./__tests__/helpers/router-setup.ts"],
    globalSetup: ["./__tests__/helpers/migrated-snapshot.ts"],
    // Booting in-memory Postgres (PGlite) can exceed 5s when files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
