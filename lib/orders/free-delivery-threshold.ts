import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";

type Reader = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };

/**
 * The current Free delivery threshold a Manager or the CEO saved in CREOMS (`crms.delivery_settings`), read fresh each
 * time. Null when it cannot be read: the rule is then not judged, and Staff's confirmation judges it instead.
 */
export async function loadFreeDeliveryThreshold(reader?: Reader): Promise<number | null> {
  try {
    const result = await (reader ?? getDatabase()).execute(sql`select free_delivery_threshold_in_centavos::text as amount from crms.delivery_settings where singleton`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: { amount: string }[] }).rows ?? []) as { amount: string }[];
    const amount = rows[0] ? Number(rows[0].amount) : NaN;
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  } catch {
    return null;
  }
}
