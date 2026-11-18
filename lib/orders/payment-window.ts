import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import { DEFAULT_PAYMENT_WINDOW_HOURS } from "./payment-deadline";

type Reader = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };

const MAX_PAYMENT_WINDOW_HOURS = 24 * 14;

/**
 * Hours a Customer has to pay once Staff confirm an Online payment Order. The Admin's setting
 * (`crms.delivery_settings.payment_window_hours`), read fresh each time; 24 when it is unset, invalid or unreadable.
 * Read before the confirmation transaction so a missing column can never abort it.
 */
export async function loadPaymentWindowHours(reader?: Reader): Promise<number> {
  try {
    const result = await (reader ?? getDatabase()).execute(sql`select payment_window_hours::text as hours from crms.delivery_settings where singleton`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: { hours: string | null }[] }).rows ?? []) as { hours: string | null }[];
    const hours = rows[0]?.hours == null ? NaN : Number(rows[0].hours);
    return Number.isInteger(hours) && hours >= 1 && hours <= MAX_PAYMENT_WINDOW_HOURS ? hours : DEFAULT_PAYMENT_WINDOW_HOURS;
  } catch {
    return DEFAULT_PAYMENT_WINDOW_HOURS;
  }
}
