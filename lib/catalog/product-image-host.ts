/** Shared by server-side address resolution and Next's image allowlist. */
export function productImageOrigin(value = process.env.PRODUCT_IMAGE_ORIGIN): URL | undefined {
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PRODUCT_IMAGE_ORIGIN must be an HTTPS origin without a path, credentials, query or fragment.");
  }
  return url;
}
