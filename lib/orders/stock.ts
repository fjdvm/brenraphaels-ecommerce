import { required } from "../gateway";

export type StockLine = { lineId: string; productId: number; quantity: number };
export type StockState = "reserved" | "released" | "deducted" | "added_back";
export interface ShopStock {
  productForSize(sizeId: number): number | Promise<number>;
  move(operation: "reserve" | "release" | "deduct" | "add_back", orderId: string, line: StockLine): Promise<StockState>;
  /** How many of a Size can still be sold, read from the IMS on demand. Never cached or polled. */
  left(sizeId: number): Promise<number>;
  /** The IMS's quantity, reserved and available for a Size, read on demand for Staff. */
  read(sizeId: number): Promise<SizeStock>;
}
export type SizeStock = { quantity: number; reserved: number; available: number };
export class StockUnavailableError extends Error {
  constructor() { super("Stock cannot be checked right now. Try again in a few minutes."); }
}
export class StockRefusedError extends Error {
  constructor() { super("There is not enough stock for this Size. Update your Cart before trying again."); }
}

/** IMS product ids identify Sizes, never names or storefront-generated ids. */
export function gatewayShopStock(fetcher: typeof fetch = fetch): ShopStock {
  return {
    async productForSize(sizeId) {
      try {
        // A Size the IMS feed created carries its IMS product id; older Sizes fall back to the explicit mapping.
        let id: unknown;
        try {
          const { getDatabase } = await import("../db");
          const { sizes } = await import("../db/schema");
          const { eq } = await import("drizzle-orm");
          id = (await getDatabase().select({ id: sizes.imsProductId }).from(sizes).where(eq(sizes.id, sizeId)))[0]?.id;
        } catch { id = undefined; }
        if (id === null || id === undefined) id = JSON.parse(required("IMS_SIZE_PRODUCT_IDS"))[String(sizeId)];
        if (!Number.isInteger(id) || (id as number) < 1 || (id as number) > 2147483647) throw new Error("Missing Size mapping");
        return id as number;
      } catch { throw new StockUnavailableError(); }
    },
    async left(sizeId) { return (await this.read(sizeId)).available; },
    async read(sizeId) { return readProductStock(await this.productForSize(sizeId), fetcher); },
    async move(operation, orderId, line) {
      // Both attempts use exactly the same immutable references after a timeout.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetcher(`${required("IMS_URL").replace(/\/$/, "")}/api/shop/stock`, {
            method: "POST", cache: "no-store",
            headers: { Authorization: `Bearer ${required("IMS_SHOP_API_KEY")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ operation, orderId, lineId: line.lineId, productId: line.productId, quantity: line.quantity }), signal: AbortSignal.timeout(5000),
          });
          if (operation === "reserve" && [404, 409].includes(response.status)) throw new StockRefusedError();
          if (!response.ok) throw new StockUnavailableError();
          const result = await response.json();
          if (result.orderId !== orderId || result.lineId !== line.lineId || result.productId !== line.productId ||
              result.quantity !== line.quantity || !["reserved", "released", "deducted", "added_back"].includes(result.state)) {
            throw new StockUnavailableError();
          }
          return result.state;
        } catch (error) {
          if (error instanceof StockRefusedError) throw error;
          if (attempt === 1) throw new StockUnavailableError();
        }
      }
      throw new StockUnavailableError();
    },
  };
}

/** The IMS's quantity, reserved and available for one IMS product id. Read on demand; never cached or polled. */
export async function readProductStock(productId: number, fetcher: typeof fetch = fetch): Promise<SizeStock> {
  try {
    const response = await fetcher(`${required("IMS_URL").replace(/\/$/, "")}/api/shop/stock?productId=${productId}`, {
      cache: "no-store", headers: { Authorization: `Bearer ${required("IMS_SHOP_API_KEY")}` }, signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) throw new StockUnavailableError();
    const { quantity, reserved, available } = await response.json();
    for (const value of [quantity, reserved, available]) if (!Number.isInteger(value) || value < 0) throw new StockUnavailableError();
    return { quantity, reserved, available };
  } catch { throw new StockUnavailableError(); }
}

/**
 * The IMS Finished Goods tab's stock per Size, for CREOMS's Stock page, in one read. A product the IMS does not
 * answer for is left out of the map. Checkout never uses this; it keeps the shop Warehouse rule in readProductStock.
 */
export async function readProductInventory(productIds: number[], fetcher: typeof fetch = fetch): Promise<Map<number, SizeStock>> {
  try {
    const response = await fetcher(`${required("IMS_URL").replace(/\/$/, "")}/api/shop/inventory?productIds=${productIds.join(",")}`, {
      cache: "no-store", headers: { Authorization: `Bearer ${required("IMS_SHOP_API_KEY")}` }, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new StockUnavailableError();
    const { products } = await response.json();
    if (!Array.isArray(products)) throw new StockUnavailableError();
    const found = new Map<number, SizeStock>();
    for (const { productId, quantity, reserved, available } of products) {
      if (Number.isInteger(productId) && [quantity, reserved, available].every((value) => Number.isInteger(value) && value >= 0)) found.set(productId, { quantity, reserved, available });
    }
    return found;
  } catch { throw new StockUnavailableError(); }
}
