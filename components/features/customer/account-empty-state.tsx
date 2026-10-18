import type { ReactNode } from "react";

/** The white card an account page shows when the Customer has nothing to list yet. */
export function AccountEmptyState({
  description,
  title,
  children,
}: {
  description: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-[40px] border border-line bg-white p-8 sm:p-10">
      <h2 className="font-serif text-[28px] leading-[1.25] text-primary">{title}</h2>
      <p className="max-w-xl leading-[1.6] tracking-[0.35px] text-body">{description}</p>
      {children}
    </div>
  );
}
