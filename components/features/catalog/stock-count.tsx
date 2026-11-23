import { stockLabel, stockLabelTone } from "@/lib/catalog/stock-label";

/** How many of a Size are left, from CREOMS's stock count; nothing when the count is unknown. */
export function StockCount({ left, className = "" }: { left: number | null | undefined; className?: string }) {
  const label = stockLabel(left ?? null);
  return label ? <span className={`text-xs font-medium ${stockLabelTone(label)} ${className}`.trim()}>{label.text}</span> : null;
}
