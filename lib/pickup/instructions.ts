import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";
import type { Order } from "@/lib/orders/orders";

/** Where and when a Customer collects a Pickup Order, as an Admin saved it in the CREOMS Portal (`crms.pickup_instructions`). */
export interface PickupInstructions {
  address: string;
  hours: string;
  note: string;
}

type Reader = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };
type Row = { country: string; region: string; province: string; city: string; barangay: string; street: string; hours: string; note: string };

/**
 * The saved instructions, read fresh on every call so a change in the Portal shows in the next email and page with no
 * deploy. Null when nothing is saved yet or the setting cannot be read; a Pickup Order must still go through.
 */
export async function loadPickupInstructions(reader?: Reader): Promise<PickupInstructions | null> {
  try {
    const result = await (reader ?? getDatabase()).execute(sql`select country, region, province, city, barangay, street, hours, note from crms.pickup_instructions where singleton`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows ?? []) as Row[];
    const row = rows[0];
    if (!row || !row.street.trim()) return null;
    const address = [row.street, row.barangay, row.city, row.province, row.region].filter((part) => part && part.trim()).join(", ");
    return { address, hours: row.hours.trim(), note: row.note.trim() };
  } catch {
    return null;
  }
}

/** True when the Order carries a Senior/PWD discount, so the Customer must bring the original ID at pickup. */
export function discountApplies(order: Pick<Order, "approvedDiscountInCentavos" | "seniorPwd">): boolean {
  return (order.approvedDiscountInCentavos ?? 0) > 0 || (order.seniorPwd?.discountInCentavos ?? 0) > 0;
}

export const ORIGINAL_ID_REMINDER = "Bring the original Senior Citizen or PWD ID you used for your discount. Photocopies and photos are not accepted.";

/** The Order-specific reminder, or null when no discount applies. */
export function pickupReminder(order: Pick<Order, "approvedDiscountInCentavos" | "seniorPwd">): string | null {
  return discountApplies(order) ? ORIGINAL_ID_REMINDER : null;
}

/** The lines a Pickup email shows: address, hours, note, then the reminder when it applies. */
export function pickupInstructionLines(instructions: PickupInstructions | null, order: Pick<Order, "approvedDiscountInCentavos" | "seniorPwd">): string[] {
  const reminder = pickupReminder(order);
  return [
    ...(instructions ? [`Pickup address: ${instructions.address}`, `Pickup hours: ${instructions.hours}`, ...(instructions.note ? [instructions.note] : [])] : []),
    ...(reminder ? [reminder] : []),
  ];
}
