import type { ReactNode } from "react";

/** The red star that marks a required field. Decorative: the input's `required` conveys it to assistive tech. */
export function RequiredMark() {
  return <span aria-hidden="true" className="ml-0.5 text-red-600">*</span>;
}

/** The note at the top of a form explaining the red star. */
export function RequiredNote() {
  return <p className="text-sm text-on-surface-variant"><span aria-hidden="true" className="text-red-600">*</span> Required field</p>;
}

/** Wires an input to its label and error message; spread onto the input. */
export function fieldProps(id: string, error?: string) {
  return { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined } as const;
}

/** A visible label (with a red star when required), the input, and its validation error. */
export function Field({ id, label, required, error, hint, children }: { id: string; label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-on-surface">
        {label}
        {required ? <RequiredMark /> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-on-surface-variant">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-sm text-red-700" role="alert">{error}</p> : null}
    </div>
  );
}
