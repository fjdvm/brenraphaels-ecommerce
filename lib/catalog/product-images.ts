import { createHash } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";

import { fileIdField } from "../validators/file-id";
import { productImageOrigin } from "./product-image-host";

export type ProductImageFiles = {
  publicUrl(productSlug: string, fileId: string): Promise<string>;
};

/** Hashing keeps tags within Next's 256-character limit even for long slugs. */
export function productImagesTag(productSlug: string): string {
  return `product-images:${createHash("sha256").update(productSlug).digest("hex")}`;
}

/** Call from a trusted Server Action or Route Handler after replacing a Product image. */
export function refreshProductImages(productSlug: string): void {
  revalidateTag(productImagesTag(productSlug), { expire: 0 });
}

/** Only addresses are cached; the gateway remains the authority for File metadata. */
export function gatewayProductImages({
  baseUrl = process.env.API_GATEWAY_URL,
  callerKey = process.env.API_GATEWAY_CALLER_KEY,
  publicOrigin = process.env.PRODUCT_IMAGE_ORIGIN,
  fetch: send = fetch,
}: { baseUrl?: string; callerKey?: string; publicOrigin?: string; fetch?: typeof fetch } = {}): ProductImageFiles {
  return {
    async publicUrl(productSlug, fileId) {
      const id = fileIdField.parse(fileId);
      const origin = productImageOrigin(publicOrigin);
      if (!baseUrl || !callerKey || !origin) {
        throw new Error("API_GATEWAY_URL, API_GATEWAY_CALLER_KEY and PRODUCT_IMAGE_ORIGIN must be set.");
      }
      return unstable_cache(async () => {
        const response = await send(`${baseUrl.replace(/\/+$/, "")}/files/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${callerKey}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`Product image resolution failed: ${response.status}`);
        const file = await response.json();
        if (file.status !== "active" || file.visibility !== "public" || file.retentionType !== "permanent" ||
            typeof file.contentType !== "string" || !file.contentType.startsWith("image/")) {
          throw new Error("A Product image must be an Active, Public, Permanent image File.");
        }
        const address = new URL(file.url);
        // The gateway supplies the object path; deployment configuration owns the public host.
        return `${origin.origin}/${address.pathname.replace(/^\/+/, "")}`;
      }, ["product-image-address-v1", baseUrl, origin.href, productSlug, id], {
        tags: [productImagesTag(productSlug)],
        revalidate: 60 * 60 * 24 * 365,
      })();
    },
  };
}
