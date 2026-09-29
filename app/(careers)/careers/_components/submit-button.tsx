"use client";

import type { ComponentProps } from "react";
import { useFormStatus } from "react-dom";

/** Submit button that disables itself and swaps its label while its parent form is submitting. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: Omit<ComponentProps<"button">, "type"> & { pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending || disabled} aria-busy={pending} className={`${props.className ?? ""} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? pendingLabel : children}
    </button>
  );
}
