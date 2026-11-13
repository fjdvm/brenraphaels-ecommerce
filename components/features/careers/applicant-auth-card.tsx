import type { HTMLAttributes, ReactNode } from "react";

import { AuthCard } from "@/components/features/auth/auth-card";
import { eyebrowClass } from "@/components/features/about/section-heading";
import { cn } from "@/lib/utils";

/** The Applicant form card: 540px and 40px-rounded on desktop, tighter and 32px-rounded on mobile. */
export function ApplicantAuthCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <AuthCard
      className={cn("max-w-[540px] gap-[18px] px-[22px] py-7 sm:gap-5 sm:px-[50px] sm:py-[46px]", className)}
      {...props}
    />
  );
}

/** Eyebrow, title and intro. On mobile the design keeps only a 22px title. */
export function ApplicantAuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className={cn(eyebrowClass, "hidden sm:block")}>Careers portal</p>
      <h1 className="font-serif text-[22px] leading-[1.3] text-primary sm:text-[40px] sm:leading-[1.2]">{title}</h1>
      {children ? <p className="hidden leading-[1.6] tracking-[0.35px] text-body sm:block">{children}</p> : null}
    </div>
  );
}
