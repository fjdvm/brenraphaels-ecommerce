export { lowStockBelow, stockLabel, type StockLabel } from "./stock-label";
import { gatewayShopStock, type ShopStock } from "../orders/stock";

/**
 * Reads what is left of each Size from the IMS at the moment of the request.
 * A Size the IMS cannot answer for is null: the shop then falls back to its own
 * available flag and checkout still refuses at placement.
 */
export async function readStockLeft(sizeIds: number[], stock: ShopStock = gatewayShopStock()): Promise<Map<number, number | null>> {
  const entries = await Promise.all([...new Set(sizeIds)].map(async (id) => {
    try { return [id, await stock.left(id)] as const; } catch { return [id, null] as const; }
  }));
  return new Map(entries);
}
