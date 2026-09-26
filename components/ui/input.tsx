import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full border border-input bg-white px-3 py-2 text-sm outline-none placeholder:text-on-surface-variant focus:ring-2 focus:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
