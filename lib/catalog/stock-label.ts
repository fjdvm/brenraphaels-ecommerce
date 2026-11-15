/** A Size with fewer than this many left shows "Only N left". */
export const lowStockBelow = 10;

export type StockLabel = { kind: "sold-out" | "low"; text: string };

/** What the shop says about a Size. Null (unknown or plenty) says nothing, so a failed IMS read never claims stock. */
export function stockLabel(left: number | null): StockLabel | null {
  if (left === null) return null;
  if (left <= 0) return { kind: "sold-out", text: "Sold out" };
  if (left < lowStockBelow) return { kind: "low", text: `Only ${left} left` };
  return null;
}
