import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import sharp from "sharp";
import { afterEach, beforeEach, expect, test } from "vitest";
import { productImages, products } from "../lib/db/schema";
import { migrateProductImages } from "../scripts/migrate-product-images.mjs";

let client: PGlite;
let db: ReturnType<typeof drizzle>;
let bytes: Uint8Array;
let files: Map<string, { contentType: string; size: number; visibility: string; retentionType: string; link: object; bytes?: Uint8Array }>;
let calls: Request[];
let nextId: number;
const gateway = { baseUrl: "https://gateway.test", callerKey: "test-key", publicOrigin: "https://images.test" };
const source = "https://store.public.blob.vercel-storage.com/catalog/jam.png";

beforeEach(async () => {
  client = new PGlite(); db = drizzle(client);
  await migrate(db, { migrationsFolder: "drizzle" });
  await db.insert(products).values({ slug: "jam", name: "Jam", description: "Ube" });
  await db.insert(productImages).values({ productSlug: "jam", url: source, alt: "Jam", position: 0 });
  bytes = new Uint8Array(await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer());
  files = new Map(); calls = []; nextId = 1;
});
afterEach(async () => { await client.close(); });

// Fake HTTP file-storage and object storage: the migration never contacts a live service.
async function send(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init); calls.push(request);
  const url = new URL(request.url);
  if (url.origin === "https://gateway.test") {
    expect(request.headers.get("authorization")).toBe("Bearer test-key");
    if (url.pathname === "/files" && request.method === "POST") {
      const id = `file-${nextId++}`;
      files.set(id, await request.json());
      return Response.json({ id, uploadUrl: `https://objects.test/${id}` });
    }
    const id = url.pathname.split("/")[2]; const file = files.get(id);
    if (!file) return new Response(null, { status: 404 });
    if (request.method === "DELETE") { files.delete(id); return new Response(null, { status: 204 }); }
    return Response.json({ ...file, bytes: undefined, id, status: "active", url: `https://images.test/${id}/original` });
  }
  expect(request.headers.get("authorization")).toBeNull();
  if (url.origin === "https://objects.test" && request.method === "PUT") {
    files.get(url.pathname.slice(1))!.bytes = new Uint8Array(await request.arrayBuffer());
    return new Response(null, { status: 200 });
  }
  if (url.origin === "https://images.test") return new Response(files.get(url.pathname.split("/")[1])!.bytes as BodyInit);
  if (request.url === source) return new Response(bytes as BodyInit, { headers: { "Content-Type": "image/png" } });
  throw new Error(`Unexpected request ${request.url}`);
}

test("copies the original into a verified Public Permanent File and preserves the Blob address", async () => {
  const result = await migrateProductImages({ db, gateway, send, dryRun: false });
  expect(result).toMatchObject({ copied: 1, failed: 0 });
  expect(await db.select().from(productImages)).toMatchObject([{ url: source, fileId: "file-1", alt: "Jam", position: 0 }]);
  expect(files.get("file-1")).toMatchObject({ contentType: "image/png", size: bytes.length, visibility: "public", retentionType: "permanent", link: { system: "IMS", entityType: "product", entityId: "jam", role: "image" }, bytes });
});

test("a repeat run skips every copied row without downloading or creating another File", async () => {
  await migrateProductImages({ db, gateway, send, dryRun: false });
  calls.length = 0;
  const events: object[] = [];
  expect(await migrateProductImages({ db, gateway, send, dryRun: false, report: event => events.push(event) })).toEqual({ copied: 0, skipped: 1, planned: 0, failed: 0 });
  expect(events).toEqual([{ status: "skipped", id: 1, fileId: "file-1" }]);
  expect(calls).toHaveLength(0); expect(files.size).toBe(1);
});

test("a dry run lists pending copies and skips File-only rows without configuration or HTTP writes", async () => {
  await db.insert(productImages).values({ productSlug: "jam", fileId: "already-copied", alt: "Second", position: 1 });
  const events: object[] = [];
  expect(await migrateProductImages({ db, send, report: event => events.push(event) })).toEqual({ copied: 0, skipped: 1, planned: 1, failed: 0 });
  expect(events).toEqual([
    { status: "planned", id: 1, productSlug: "jam", url: source },
    { status: "skipped", id: 2, fileId: "already-copied" },
  ]);
  expect(calls).toHaveLength(0);
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: null, url: source }, { fileId: "already-copied", url: null }]);
});

test("a failed copy leaves its row unchanged, removes the new File and reports the failure", async () => {
  const before = await db.select().from(productImages);
  const events: object[] = [];
  const corrupt: typeof fetch = async (input, init) => String(input).startsWith("https://images.test/")
    ? new Response(new Uint8Array([1, 2, 3])) : send(input, init);
  expect(await migrateProductImages({ db, gateway, send: corrupt, dryRun: false, report: event => events.push(event) })).toMatchObject({ copied: 0, failed: 1 });
  expect(events).toEqual([{ status: "failed", id: 1, fileId: "file-1", reason: "Copied image bytes do not match the Blob original." }]);
  expect(await db.select().from(productImages)).toEqual(before);
  expect(files.size).toBe(0);
  expect(await migrateProductImages({ db, gateway, send, dryRun: false })).toMatchObject({ copied: 1, failed: 0 });
  expect(files.size).toBe(1);
});

test.each(["download", "upload", "confirm", "view"])("reports a %s refusal, preserves the Blob and continues with later rows", async stage => {
  await db.insert(productImages).values({ productSlug: "jam", url: source, alt: "Second", position: 1 });
  let failed = false;
  const refuse: typeof fetch = async (input, init) => {
    const url = String(input);
    const match = stage === "download" ? url === source : stage === "upload" ? init?.method === "PUT" : stage === "confirm" ? url.endsWith("/confirm") : url === "https://gateway.test/files/file-1" && !init?.method?.includes("DELETE");
    if (match && !failed) { failed = true; return new Response(null, { status: 503 }); }
    return send(input, init);
  };
  expect(await migrateProductImages({ db, gateway, send: refuse, dryRun: false })).toMatchObject({ copied: 1, failed: 1 });
  expect(await db.select().from(productImages).orderBy(productImages.id)).toMatchObject([{ fileId: null, url: source }, { fileId: expect.any(String), url: source }]);
  expect(files.size).toBe(1);
});

test("a rejected File is reported even when cleanup fails, without changing its row", async () => {
  const events: object[] = [];
  const refuse: typeof fetch = async (input, init) => {
    if (String(input).startsWith("https://images.test/")) return new Response(new Uint8Array([1]));
    if (init?.method === "DELETE") return new Response(null, { status: 503 });
    return send(input, init);
  };
  expect(await migrateProductImages({ db, gateway, send: refuse, dryRun: false, report: event => events.push(event) })).toMatchObject({ failed: 1, copied: 0 });
  expect(events).toMatchObject([{ status: "failed", id: 1, fileId: "file-1", cleanupError: "File storage DELETE failed: HTTP 503" }]);
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: null, url: source }]);
});

test.each([new Uint8Array(), new TextEncoder().encode("not an image"), new Uint8Array(25 * 1024 * 1024 + 1)])("refuses invalid original bytes before creating a File", async invalid => {
  bytes = invalid;
  expect(await migrateProductImages({ db, gateway, send, dryRun: false })).toMatchObject({ failed: 1, copied: 0 });
  expect(files.size).toBe(0);
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: null, url: source }]);
});

test("the configured public origin remains authoritative even for a gateway path starting with two slashes", async () => {
  const addresses: string[] = [];
  const oddPath: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://gateway.test/files/file-1" && init?.method === "GET") {
      const response = await send(input, init);
      return Response.json({ ...await response.json(), url: "https://old-bucket.r2.dev//foreign.test/original" });
    }
    if (url.includes("/original")) { addresses.push(url); return new Response(bytes as BodyInit); }
    return send(input, init);
  };
  expect(await migrateProductImages({ db, gateway, send: oddPath, dryRun: false })).toMatchObject({ copied: 1, failed: 0 });
  expect(addresses).toEqual(["https://images.test/foreign.test/original"]);
});

test("two runs copying the same row create only one File", async () => {
  const results = await Promise.all([
    migrateProductImages({ db, gateway, send, dryRun: false }),
    migrateProductImages({ db, gateway, send, dryRun: false }),
  ]);
  expect(results.map(result => result.copied).sort()).toEqual([0, 1]);
  expect(results.map(result => result.skipped).sort()).toEqual([0, 1]);
  expect(files.size).toBe(1);
});

test("a lost database commit response is reconciled without deleting the saved File", async () => {
  const uncertain = {
    select: db.select.bind(db),
    transaction: async (run: Parameters<typeof db.transaction>[0]) => {
      await db.transaction(run);
      throw new Error("Commit response lost");
    },
  };
  const events: object[] = [];
  expect(await migrateProductImages({ db: uncertain, gateway, send, dryRun: false, report: event => events.push(event) })).toEqual({ copied: 1, failed: 0, planned: 0, skipped: 0 });
  expect(events).toEqual([{ status: "copied", id: 1, fileId: "file-1", reconciled: true }]);
  expect(files.size).toBe(1);
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: "file-1", url: source }]);
});

test("a rolled-back database write removes the unreferenced copy and keeps the original row", async () => {
  const failing = {
    select: db.select.bind(db),
    transaction: async (run: Parameters<typeof db.transaction>[0]) => db.transaction(async tx => {
      await run(tx); throw new Error("Commit failed");
    }),
  };
  const events: object[] = [];
  expect(await migrateProductImages({ db: failing, gateway, send, dryRun: false, report: event => events.push(event) })).toMatchObject({ copied: 0, failed: 1 });
  expect(events).toEqual([{ status: "failed", id: 1, fileId: "file-1", reason: "Commit failed" }]);
  expect(files.size).toBe(0);
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: null, url: source }]);
});

test("the image MIME is detected from the original bytes rather than the Blob response header", async () => {
  const mislabeled: typeof fetch = async (input, init) => String(input) === source
    ? new Response(bytes as BodyInit, { headers: { "Content-Type": "application/pdf" } }) : send(input, init);
  expect(await migrateProductImages({ db, gateway, send: mislabeled, dryRun: false })).toMatchObject({ copied: 1, failed: 0 });
  expect(files.get("file-1")?.contentType).toBe("image/png");
});

test("a Private File returned by the gateway cannot become a storefront Product image", async () => {
  const privateFile: typeof fetch = async (input, init) => {
    const response = await send(input, init);
    if (String(input) === "https://gateway.test/files/file-1" && init?.method === "GET") {
      return Response.json({ ...await response.json(), visibility: "private" });
    }
    return response;
  };
  expect(await migrateProductImages({ db, gateway, send: privateFile, dryRun: false })).toMatchObject({ copied: 0, failed: 1 });
  expect(await db.select().from(productImages)).toMatchObject([{ fileId: null, url: source }]);
  expect(files.size).toBe(0);
});

test("does not report a cleanup failure when confirmation has already rejected and removed the File", async () => {
  const events: object[] = [];
  const rejected: typeof fetch = async (input, init) => {
    if (String(input).endsWith("/confirm")) { files.clear(); return new Response(null, { status: 422 }); }
    return send(input, init);
  };
  expect(await migrateProductImages({ db, gateway, send: rejected, dryRun: false, report: event => events.push(event) })).toMatchObject({ failed: 1, copied: 0 });
  expect(events).toEqual([{ status: "failed", id: 1, fileId: "file-1", reason: "File storage POST failed: HTTP 422" }]);
});
