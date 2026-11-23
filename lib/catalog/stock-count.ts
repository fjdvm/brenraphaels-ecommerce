import { sql } from "drizzle-orm";

import type { ShopStock } from "../orders/stock";
import { readStockLeft } from "./stock-labels";

/** How many of each Size the shop can sell; null when it is not known, and the shop then does not list the Size. */
export type StockCountReader = { left(sizeIds: number[]): Promise<Map<number, number | null>> };

/**
 * CREOMS's stock count (`crms.stock_count`), which the IMS keeps current on every change: the same figures CREOMS's
 * In store tab shows. One read for the whole list, by each Size's IMS product id. A Size with no count, or a failed read,
 * is unknown (null), so the shop never lists something CREOMS shows as sold out.
 */
export function databaseStockCount(reader: { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> }): StockCountReader {
  return {
    async left(sizeIds) {
      const wanted = [...new Set(sizeIds)];
      const found = new Map<number, number | null>(wanted.map((id) => [id, null]));
      if (wanted.length === 0) return found;
      try {
        const result = await reader.execute(sql`
          select s.id, c.available from sizes s join crms.stock_count c on c.ims_product_id = s.ims_product_id
          where s.id in (${sql.join(wanted.map((id) => sql`${id}`), sql`, `)})`);
        const rows = (Array.isArray(result) ? result : (result as { rows: unknown[] }).rows) as { id: number; available: number | string | null }[];
        for (const row of rows) {
          const available = row.available === null ? null : Number(row.available);
          found.set(Number(row.id), available !== null && Number.isInteger(available) ? available : null);
        }
      } catch (error) {
        console.error("CREOMS's stock count could not be read", error);
      }
      return found;
    },
  };
}

/** The IMS read per Size, for tests and tools that work without CREOMS's count. */
export const shopStockCount = (stock: ShopStock): StockCountReader => ({ left: (sizeIds) => readStockLeft(sizeIds, stock) });
