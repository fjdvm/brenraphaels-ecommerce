import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** A native dropdown, so phones show their own picker. */
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full border border-input bg-white px-3 py-2 text-base outline-none sm:text-sm focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant",
        className,
      )}
      {...props}
    />
  );
}
