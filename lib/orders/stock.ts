import { required } from "../gateway";

export type StockLine = { lineId: string; productId: number; quantity: number };
export type StockState = "reserved" | "released" | "deducted" | "added_back";
export interface ShopStock {
  productForSize(sizeId: number): number;
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
    productForSize(sizeId) {
      try {
        const mapping = JSON.parse(required("IMS_SIZE_PRODUCT_IDS"));
        const id = mapping[String(sizeId)];
        if (!Number.isInteger(id) || id < 1 || id > 2147483647) throw new Error("Missing Size mapping");
        return id;
      } catch { throw new StockUnavailableError(); }
    },
    async left(sizeId) { return (await this.read(sizeId)).available; },
    async read(sizeId) {
      const productId = this.productForSize(sizeId);
      try {
        const response = await fetcher(`${required("IMS_URL").replace(/\/$/, "")}/api/shop/stock?productId=${productId}`, {
          cache: "no-store", headers: { Authorization: `Bearer ${required("IMS_SHOP_API_KEY")}` }, signal: AbortSignal.timeout(3000),
        });
        if (!response.ok) throw new StockUnavailableError();
        const { quantity, reserved, available } = await response.json();
        for (const value of [quantity, reserved, available]) if (!Number.isInteger(value) || value < 0) throw new StockUnavailableError();
        return { quantity, reserved, available };
      } catch { throw new StockUnavailableError(); }
    },
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
