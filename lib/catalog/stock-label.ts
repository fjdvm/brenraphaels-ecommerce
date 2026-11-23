/** A Size with fewer than this many left shows "Only N left" as a warning. */
export const lowStockBelow = 10;

export type StockLabel = { kind: "sold-out" | "low" | "in-stock"; text: string };

/**
 * What the shop says about a Size's count: "N left", "Only N left" when it runs low, or "Sold out".
 * Null (unknown) says nothing, so a failed read never claims stock.
 */
export function stockLabel(left: number | null): StockLabel | null {
  if (left === null) return null;
  if (left <= 0) return { kind: "sold-out", text: "Sold out" };
  if (left < lowStockBelow) return { kind: "low", text: `Only ${left} left` };
  return { kind: "in-stock", text: `${left} left` };
}

/** The colour of a Size's count: a warning when it runs low, quiet otherwise. */
export function stockLabelTone(label: StockLabel): string {
  return label.kind === "in-stock" ? "text-muted" : "text-warning";
}
