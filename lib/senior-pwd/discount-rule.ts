import { sql } from "drizzle-orm";

import { getDatabase } from "@/lib/db";

export const discountKinds = ["percent", "pesos"] as const;
export const limitPeriods = ["day", "week", "month"] as const;
export type DiscountKind = (typeof discountKinds)[number];
export type LimitPeriod = (typeof limitPeriods)[number];

/**
 * The Senior/PWD discount a Manager or the CEO sets in CREOMS Commerce Settings: a percentage or a pesos amount off one
 * item, and the most one ID can get per day, week or month. `hundredths` is a percentage times 100 (500 = 5%) or centavos.
 */
export type DiscountRule = { kind: DiscountKind; hundredths: number; limitInCentavos: number; per: LimitPeriod };

/** Today's rule, used until CREOMS has saved one or when it cannot be read: 5% off one item, up to ₱125 per week. */
export const DEFAULT_DISCOUNT_RULE: DiscountRule = { kind: "percent", hundredths: 500, limitInCentavos: 12_500, per: "week" };

type Reader = { execute: (query: ReturnType<typeof sql>) => PromiseLike<unknown> };
type Row = { kind: string; hundredths: string; limit: string; per: string };

/** The rule saved in CREOMS (`crms.senior_pwd_discount_settings`), read fresh each time; the default when it cannot be read. */
export async function loadDiscountRule(reader?: Reader): Promise<DiscountRule> {
  try {
    const result = await (reader ?? getDatabase()).execute(sql`select discount_kind as kind, discount_hundredths::text as hundredths, limit_in_centavos::text as "limit", limit_per as per from crms.senior_pwd_discount_settings where singleton`);
    const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows ?? []) as Row[];
    return parseRule(rows[0]) ?? DEFAULT_DISCOUNT_RULE;
  } catch {
    return DEFAULT_DISCOUNT_RULE;
  }
}

function parseRule(row: Row | undefined): DiscountRule | null {
  if (!row) return null;
  const hundredths = Number(row.hundredths);
  const limitInCentavos = Number(row.limit);
  if (!(discountKinds as readonly string[]).includes(row.kind) || !(limitPeriods as readonly string[]).includes(row.per)) return null;
  if (!Number.isSafeInteger(hundredths) || hundredths <= 0 || !Number.isSafeInteger(limitInCentavos) || limitInCentavos <= 0) return null;
  if (row.kind === "percent" && hundredths > 10_000) return null;
  return { kind: row.kind as DiscountKind, hundredths, limitInCentavos, per: row.per as LimitPeriod };
}

/** The discount for one unit at this price, in centavos: never more than the unit costs. */
export function ruleDiscount(rule: DiscountRule, unitPriceInCentavos: number): number {
  const wanted = rule.kind === "percent" ? Math.round((unitPriceInCentavos * rule.hundredths) / 10_000) : rule.hundredths;
  return Math.min(wanted, unitPriceInCentavos);
}

/** The Cart line that gets the discount: one unit of the item that saves the Customer the most. */
export function discountedLine<Line extends { priceInCentavos: number }>(lines: readonly Line[]): Line | undefined {
  return lines.reduce<Line | undefined>((best, line) => (best === undefined || line.priceInCentavos > best.priceInCentavos ? line : best), undefined);
}

const peso = (centavos: number) => (centavos % 100 === 0 ? `₱${centavos / 100}` : `₱${(centavos / 100).toFixed(2)}`);

/** "5% off" or "₱50 off". */
export function describeDiscount(rule: DiscountRule): string {
  return rule.kind === "percent" ? `${rule.hundredths / 100}% off` : `${peso(rule.hundredths)} off`;
}

/** "5% off 1 item, up to ₱125 per week". */
export function describeRule(rule: DiscountRule): string {
  return `${describeDiscount(rule)} 1 item, up to ${peso(rule.limitInCentavos)} per ${rule.per}`;
}
