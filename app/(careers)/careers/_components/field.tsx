import { X } from "lucide-react";
import type { ReactNode } from "react";

import { fieldLabelClass } from "@/components/ui/field-styles";

/** The red star that marks a required field. Decorative: the input's `required` conveys it to assistive tech. */
export function RequiredMark() {
  return <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>;
}

/** The note at the top of a form explaining the red star. */
export function RequiredNote() {
  return <p className="text-sm tracking-[0.35px] text-body"><span aria-hidden="true" className="text-red-600">*</span> Required field</p>;
}

/** Wires an input to its label and error message; spread onto the input. */
export function fieldProps(id: string, error?: string) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined } as const;
}

/** A visible label (with a red star when required), the input, and its validation error. */
export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs tracking-[0.35px] text-muted">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="flex items-center gap-1.5 text-xs tracking-[0.35px] text-red-700" role="alert"><X aria-hidden className="size-3.5 shrink-0" />{error}</p> : null}
    </div>
  );
}
