import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { fileTypeFromBuffer } from "file-type";
import postgres from "postgres";

import { productImages } from "../lib/db/schema.ts";
import { productImageOrigin } from "../lib/catalog/product-image-host.ts";

const MAX_BYTES = 25 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function https(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Image addresses must use HTTPS without credentials.");
  return url;
}

async function readBytes(response) {
  if (!response.ok || !response.body) throw new Error(`Image download failed: HTTP ${response.status}`);
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error("Image exceeds 25 MiB."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!size) throw new Error("Image is empty.");
  return Buffer.concat(chunks, size);
}

/** @param {Record<string, unknown>} event */
function ignoreReport(event) { void event; }

/** Public script entry point. Tests supply a real throwaway database and fake HTTP services. */
export async function migrateProductImages({ db, gateway = {}, send = fetch, dryRun = true, report = ignoreReport }) {
  const summary = { copied: 0, skipped: 0, planned: 0, failed: 0 };
  const rows = await db.select().from(productImages).orderBy(productImages.id);
  async function download(url) {
    return readBytes(await send(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(60_000) }));
  }
  async function call(path, method = "GET", body) {
    const base = https(gateway.baseUrl).href.replace(/\/+$/, "");
    if (!gateway.callerKey) throw new Error("API_GATEWAY_CALLER_KEY is required.");
    const response = await send(`${base}/files${path}`, {
      method, headers: { Authorization: `Bearer ${gateway.callerKey}`, "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}), redirect: "error", signal: AbortSignal.timeout(60_000),
    });
    if (method === "DELETE" && response.status === 404) return;
    if (!response.ok) throw new Error(`File storage ${method} failed: HTTP ${response.status}`);
    return response.status === 204 ? undefined : response.json();
  }
  for (const row of rows) {
    let fileId;
    try {
      if (row.fileId) { summary.skipped++; report({ status: "skipped", id: row.id, fileId: row.fileId }); continue; }
      if (!row.url) throw new Error("Product image has no Blob address.");
      const source = https(row.url);
      if (!source.hostname.endsWith(".public.blob.vercel-storage.com")) throw new Error("Source is not a public Vercel Blob address.");
      if (dryRun) { summary.planned++; report({ status: "planned", id: row.id, productSlug: row.productSlug, url: row.url }); continue; }
      const origin = productImageOrigin(gateway.publicOrigin);
      if (!origin) throw new Error("PRODUCT_IMAGE_ORIGIN is required.");
      // Serialize competing runs for this row and read its current reference before creating a File.
      const result = await db.transaction(async tx => {
        const [current] = await tx.select().from(productImages).where(eq(productImages.id, row.id)).for("update");
        if (!current) throw new Error("Product image was removed during migration.");
        if (current.fileId) return { status: "skipped", fileId: current.fileId };
        if (current.url !== row.url) throw new Error("Blob address changed during migration; run again.");
        const bytes = await download(source.href);
        const detected = await fileTypeFromBuffer(bytes);
        const contentType = detected?.mime === "image/apng" ? "image/png" : detected?.mime;
        if (!imageTypes.has(contentType)) throw new Error("Blob is not a supported JPEG, PNG, GIF or WebP image.");
        const pending = await call("", "POST", {
          filename: `product-${current.id}.${contentType === "image/png" ? "png" : detected.ext}`,
          contentType, size: bytes.length, visibility: "public", retentionType: "permanent",
          link: { system: "IMS", entityType: "product", entityId: current.productSlug, role: "image" },
        });
        if (typeof pending.id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(pending.id)) throw new Error("Storage returned no File id.");
        fileId = pending.id;
        const put = await send(https(pending.uploadUrl).href, {
          method: "PUT", headers: { "Content-Type": contentType }, body: bytes,
          redirect: "error", signal: AbortSignal.timeout(60_000),
        });
        if (!put.ok) throw new Error(`Storage upload failed: HTTP ${put.status}`);
        await call(`/${encodeURIComponent(fileId)}/confirm`, "POST");
        const stored = await call(`/${encodeURIComponent(fileId)}`);
        if (stored.id !== fileId || stored.status !== "active" || stored.visibility !== "public" ||
            stored.retentionType !== "permanent" || stored.size !== bytes.length || stored.contentType !== contentType) {
          throw new Error("Copied File metadata does not match an Active, Public, Permanent image.");
        }
        // Use the same configured public host as storefront reads; check the original, not a Variant.
        const publicUrl = new URL(`${origin.origin}/${https(stored.url).pathname.replace(/^\/+/, "")}`);
        const copied = await download(publicUrl.href);
        const hash = value => createHash("sha256").update(value).digest("hex");
        if (hash(copied) !== hash(bytes)) throw new Error("Copied image bytes do not match the Blob original.");
        await tx.update(productImages).set({ fileId }).where(eq(productImages.id, current.id));
        return { status: "copied", fileId };
      });
      summary[result.status]++; report({ ...result, id: row.id });
    } catch (error) {
      let cleanupError;
      if (fileId) {
        // A lost COMMIT response must never cause deletion of a File already referenced by the row.
        try {
          const [current] = await db.select().from(productImages).where(eq(productImages.id, row.id));
          if (current?.fileId === fileId) {
            summary.copied++; report({ status: "copied", id: row.id, fileId, reconciled: true }); continue;
          }
          await call(`/${encodeURIComponent(fileId)}`, "DELETE");
        } catch (cleanup) { cleanupError = cleanup.message; }
      }
      summary.failed++;
      report({ status: "failed", id: row.id, reason: error.message, ...(fileId ? { fileId } : {}), ...(cleanupError ? { cleanupError } : {}) });
    }
  }
  return summary;
}

export async function main(args = process.argv.slice(2)) {
  if (args.some(arg => !["--apply", "--dry-run"].includes(arg)) || (args.includes("--apply") && args.includes("--dry-run"))) {
    throw new Error("Usage: npm run catalog:images:migrate -- [--dry-run | --apply]");
  }
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_UNPOOLED (or DATABASE_URL) is required.");
  const dryRun = !args.includes("--apply");
  const gateway = { baseUrl: process.env.API_GATEWAY_URL, callerKey: process.env.API_GATEWAY_CALLER_KEY, publicOrigin: process.env.PRODUCT_IMAGE_ORIGIN };
  if (!dryRun && (!gateway.baseUrl || !gateway.callerKey || !gateway.publicOrigin)) {
    throw new Error("API_GATEWAY_URL, API_GATEWAY_CALLER_KEY and PRODUCT_IMAGE_ORIGIN are required for --apply.");
  }
  const client = postgres(connectionString, { prepare: false, max: 1 });
  try {
    const summary = await migrateProductImages({ db: drizzle(client), gateway, dryRun, report: event => console.log(JSON.stringify(event)) });
    console.log(JSON.stringify({ status: "summary", dryRun, ...summary }));
    if (summary.failed) process.exitCode = 1;
    return summary;
  } finally { await client.end(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
