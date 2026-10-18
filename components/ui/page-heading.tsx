import type { ReactNode } from "react";

/** Eyebrow + serif H1 used at the top of storefront pages; `aside` sits at the right edge. */
export function PageHeading({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="flex flex-col gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">{eyebrow}</p>
        <h1 className="font-serif text-4xl leading-[1.2] text-primary sm:text-[54px]">{title}</h1>
        {children}
      </div>
      {aside}
    </div>
  );
}
