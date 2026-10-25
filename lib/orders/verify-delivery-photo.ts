import { required } from "../gateway";

export class InvalidDeliveryPhoto extends Error {}
export class DeliveryPhotoUnavailable extends Error {}

/** Checks file-storage metadata through the gateway; Temporary photos are promoted by CREOMS after delivery. */
export async function verifyDeliveryPhoto(fileId: string, send: typeof fetch = fetch) {
  try {
    const base = required("API_GATEWAY_URL").replace(/\/$/, "");
    const response = await send(`${base}/files/${encodeURIComponent(fileId)}`, {
      headers: { Authorization: `Bearer ${required("API_GATEWAY_CALLER_KEY")}` },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 404) throw new InvalidDeliveryPhoto("Delivery photo File was not found.");
    if (!response.ok) throw new DeliveryPhotoUnavailable();
    const file = await response.json();
    if (file?.id !== fileId) throw new InvalidDeliveryPhoto("Delivery photo File was not found.");
    if (file.status !== "active") throw new InvalidDeliveryPhoto("Delivery photo File must be Active.");
    if (file.visibility !== "private") throw new InvalidDeliveryPhoto("Delivery photo File must be Private.");
    if (typeof file.contentType !== "string" || !file.contentType.startsWith("image/")) {
      throw new InvalidDeliveryPhoto("Delivery photo File must be an image.");
    }
  } catch (error) {
    if (error instanceof InvalidDeliveryPhoto) throw error;
    throw new DeliveryPhotoUnavailable("Delivery photo could not be verified. Refresh before retrying.");
  }
}
