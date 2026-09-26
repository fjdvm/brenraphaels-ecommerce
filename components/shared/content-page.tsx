import type { ReactNode } from "react";

export function ContentPage({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-h-[60vh] bg-surface px-5 py-16 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[.18em] text-secondary">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-serif text-4xl text-primary sm:text-5xl">
          {title}
        </h1>
        <div className="mt-10 space-y-8 border-t border-outline-variant/60 pt-8 leading-7 text-on-surface-variant">
          {children}
        </div>
      </div>
    </section>
  );
}
