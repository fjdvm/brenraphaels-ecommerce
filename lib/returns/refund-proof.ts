import sharp from "sharp";

import { required } from "../gateway";

const maxBytes = 5_242_880;
export class InvalidRefundProof extends Error {}
export class RefundProofUnavailable extends Error {}
const invalid = () => new InvalidRefundProof("Refund proof must be a confirmed Private, Permanent JPG/PNG image up to 5 MB linked to this Return.");

/** Read through the storefront Caller; only a CRMS return/refund-proof Link authorizes this purpose. */
export async function verifyRefundProof(fileId: string, returnId: number, send: typeof fetch = fetch) {
  try {
    const base = required("API_GATEWAY_URL").replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}` };
    const options = { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) } as const;
    const query = new URLSearchParams({ system: "CRMS", entityType: "return", entityId: String(returnId), role: "refund-proof" });
    // Look up the exact record rather than trusting an arbitrary caller-supplied File id.
    let page: string | undefined;
    const seen = new Set<string>();
    let linked = false;
    do {
      if (page) query.set("page", page);
      const response = await send(`${base}/files?${query}`, options);
      if (!response.ok) throw new RefundProofUnavailable();
      const result = await response.json();
      if (!Array.isArray(result.files)) throw new RefundProofUnavailable();
      linked = result.files.some((file: { id: string }) => file.id === fileId);
      page = result.nextPage ?? undefined;
      if (page && (typeof page !== "string" || seen.has(page))) throw new RefundProofUnavailable();
      if (page) seen.add(page);
    } while (!linked && page);
    if (!linked) throw invalid();

    const response = await send(`${base}/files/${encodeURIComponent(fileId)}`, options);
    if (response.status === 404) throw invalid();
    if (!response.ok) throw new RefundProofUnavailable();
    const file = await response.json();
    if (file.id !== fileId || file.status !== "active" || file.visibility !== "private" ||
      file.retentionType !== "permanent" || file.expiresAt !== null ||
      !Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxBytes ||
      !["image/jpeg", "image/png"].includes(file.contentType)) throw invalid();

    const url = new URL(file.url);
    if (url.protocol !== "https:") throw invalid();
    // Never send the Caller credential to a signed storage URL.
    const image = await send(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000) });
    if (!image.ok || !image.body) throw new RefundProofUnavailable();
    const reader = image.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes || size > file.size) throw invalid();
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const bytes = Buffer.concat(chunks);
    if (size !== file.size) throw invalid();
    try {
      // Decode the whole screenshot: a signature alone also matches truncated/non-image files.
      const image = sharp(bytes, { failOn: "warning", limitInputPixels: 40_000_000 });
      const { format } = await image.metadata();
      if (format !== (file.contentType === "image/png" ? "png" : "jpeg")) throw invalid();
      await image.resize(1, 1).raw().toBuffer();
    } catch {
      throw invalid();
    }
  } catch (error) {
    if (error instanceof InvalidRefundProof || error instanceof RefundProofUnavailable) throw error;
    throw new RefundProofUnavailable("Refund proof could not be verified. Refresh before retrying.");
  }
}
