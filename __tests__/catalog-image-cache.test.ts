import "next/dist/server/node-environment-baseline";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { IncrementalCache } from "next/dist/server/lib/incremental-cache";
import FileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache";
import { createWorkStore } from "next/dist/server/async-storage/work-store";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";

import { createCatalogStore } from "../lib/catalog/catalog";
import { gatewayProductImages, refreshProductImages } from "../lib/catalog/product-images";
import { products, productImages, sizes } from "../lib/db/schema";

let client: PGlite;
let cache: IncrementalCache;
const slug = `jam-${randomUUID()}`;

beforeEach(async () => {
  client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  cache = new IncrementalCache({
    dev: false, requestHeaders: {}, flushToDisk: false, maxMemoryCacheSize: 1024 * 1024,
    CurCacheHandler: FileSystemCache,
    getPrerenderManifest: () => ({
      version: 4, routes: {}, dynamicRoutes: {}, notFoundRoutes: [],
      preview: { previewModeId: "test", previewModeSigningKey: "test", previewModeEncryptionKey: "test" },
    }),
  });
  vi.stubGlobal("__incrementalCache", cache);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await client.close();
});

async function refresh(slug: string) {
  const work = createWorkStore({
    page: "/api/product-images/route", buildId: "test", deploymentId: "test", previouslyRevalidatedTags: [],
    renderOpts: {
      incrementalCache: cache, cacheLifeProfiles: { default: { stale: 300, revalidate: 900, expire: 86400 } }, staticPageGenerationTimeout: 60,
      cacheComponents: false, validationLevel: "warning", supportsDynamicResponse: true,
      experimental: { authInterrupts: false, useCacheTimeout: 30 }, onClose: () => {}, waitUntil: undefined, onAfterTaskError: undefined,
    },
  });
  workAsyncStorage.run(work, () => refreshProductImages(slug));
  // Next drains these pending invalidations when the Route Handler completes.
  for (const { tag, profile } of work.pendingRevalidatedTags ?? []) {
    await cache.revalidateTag(tag, typeof profile === "object" ? profile : undefined);
  }
}

test("product reads share cached public addresses across stores; refreshing one Product leaves the other cached", async () => {
  const database = drizzle(client);
  for (const productSlug of [slug, `${slug}-other`]) {
    await database.insert(products).values({ slug: productSlug, name: productSlug, description: "Jam." });
    await database.insert(productImages).values({ productSlug, fileId: productSlug, alt: "Jam", position: 0 });
    await database.insert(sizes).values({ productSlug, label: "250g", priceInCentavos: 21900, available: true });
  }
  let version = "original";
  const send = vi.fn<typeof fetch>(async (url, init) => {
    expect(init?.headers).toEqual({ Authorization: "Bearer test-key" });
    return Response.json({
      status: "active", visibility: "public", retentionType: "permanent", contentType: "image/jpeg",
      url: `https://old-bucket.r2.dev/${String(url).split("/").at(-1)}/${version}`,
    });
  });
  let publicOrigin = "https://images.example";
  const read = () => createCatalogStore(database, gatewayProductImages({
    baseUrl: "https://gateway.example/", callerKey: "test-key", publicOrigin, fetch: send,
  }));
  expect((await read().findProduct(slug))?.images).toEqual([{ url: `https://images.example/${slug}/original`, alt: "Jam" }]);
  await read().findProduct(slug);
  const listed = await read().listProducts();
  expect(listed.find((p) => p.slug === slug)?.image).toBe(`https://images.example/${slug}/original`);
  expect(send).toHaveBeenCalledTimes(2);

  version = "replacement";
  await refresh(slug);
  expect((await read().findProduct(slug))?.images[0].url).toBe(`https://images.example/${slug}/replacement`);
  expect((await read().findProduct(`${slug}-other`))?.images[0].url).toBe(`https://images.example/${slug}-other/original`);
  expect(send).toHaveBeenCalledTimes(3);

  publicOrigin = "https://cdn.example";
  expect((await read().findProduct(slug))?.images[0].url).toBe(`https://cdn.example/${slug}/replacement`);
  expect(send).toHaveBeenCalledTimes(4);
  vi.stubEnv("PRODUCT_IMAGE_ORIGIN", publicOrigin);
  const { default: config } = await import("../next.config");
  expect(config.images?.remotePatterns).toContainEqual(new URL("https://cdn.example/**"));
  expect(JSON.stringify(config.images?.remotePatterns)).not.toMatch(/blob/i);
});

test("a row without a File id never yields its retained Blob address and needs no gateway call", async () => {
  const database = drizzle(client);
  await database.insert(products).values({ slug, name: "Jam", description: "Jam." });
  await database.insert(productImages).values([
    { productSlug: slug, url: "https://blob.example/second.jpg", alt: "Back", position: 1 },
    { productSlug: slug, url: "https://blob.example/first.jpg", alt: "Front", position: 0 },
  ]);
  const send = vi.fn<typeof fetch>();
  const store = createCatalogStore(database, gatewayProductImages({ baseUrl: "", callerKey: "", publicOrigin: "", fetch: send }));
  expect((await store.findProduct(slug))?.images).toEqual([
    { url: "", alt: "Front" },
    { url: "", alt: "Back" },
  ]);
  expect(send).not.toHaveBeenCalled();
});

test("a refused resolution is retried, and a Private address is never exposed as a Product image", async () => {
  const database = drizzle(client);
  await database.insert(products).values({ slug, name: "Jam", description: "Jam." });
  await database.insert(productImages).values({ productSlug: slug, fileId: "private-file", alt: "Jam", position: 0 });
  const send = vi.fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ status: "active", visibility: "private", retentionType: "permanent", contentType: "image/jpeg", url: "https://signed.example/private" }))
    .mockResolvedValueOnce(Response.json({ status: "active", visibility: "public", retentionType: "permanent", contentType: "image/jpeg", url: "https://bucket.r2.dev/private-file/original" }));
  const store = createCatalogStore(database, gatewayProductImages({
    baseUrl: "https://gateway.example", callerKey: "test-key", publicOrigin: "https://images.example", fetch: send,
  }));
  await expect(store.findProduct(slug)).rejects.toThrow("503");
  await expect(store.findProduct(slug)).rejects.toThrow("Public");
  expect((await store.findProduct(slug))?.images[0].url).toBe("https://images.example/private-file/original");
  expect(send).toHaveBeenCalledTimes(3);
});
