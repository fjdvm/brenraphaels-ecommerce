import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Booting in-memory Postgres (PGlite) can exceed 5s when files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
