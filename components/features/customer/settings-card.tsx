import type { ReactNode } from "react";

/** One settings section: its title and blurb on the left, its form on the right. */
export function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 rounded-[40px] border border-line bg-white p-6 sm:p-10 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)] lg:gap-8">
      <div className="flex flex-col gap-2">
        <h2 className="font-serif text-[28px] leading-[1.25] text-primary">{title}</h2>
        <p className="text-sm leading-[1.6] tracking-[0.35px] text-body">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function SettingsField({ label, htmlFor, required, error, errorId, children }: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-medium tracking-[0.35px] text-ink" htmlFor={htmlFor}>
        {label}
        {required ? <span aria-hidden className="ml-0.5 text-red-700">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-sm text-red-700" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}
