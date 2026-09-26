import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // Mirrors the "@/*" path alias in tsconfig.json.
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // Booting in-memory Postgres (PGlite) can exceed 5s when files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
