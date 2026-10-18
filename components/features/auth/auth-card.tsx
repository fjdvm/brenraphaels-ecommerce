import type { HTMLAttributes, ReactNode } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";
import { cn } from "@/lib/utils";

/** The white rounded card every auth page sits in. */
export function AuthCard({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex w-full max-w-[520px] flex-col gap-[22px] rounded-[40px] border border-line bg-white p-6 sm:p-[50px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** An optional eyebrow over a 40px serif title, with an optional line beneath. */
export function AuthHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {eyebrow ? <p className={eyebrowClass}>{eyebrow}</p> : null}
      <h1 className="font-serif text-[32px] leading-[1.2] text-primary sm:text-[40px]">
        {title}
      </h1>
      {children ? (
        <p className="leading-[1.6] tracking-[0.35px] text-body">{children}</p>
      ) : null}
    </div>
  );
}

export const authLinkClass = "font-medium text-primary underline underline-offset-2";

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}
