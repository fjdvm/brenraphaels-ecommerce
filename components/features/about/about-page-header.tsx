import type { ReactNode } from "react";

import { eyebrowClass } from "@/components/features/about/section-heading";

/** The title block that opens every About page: eyebrow, display title, a short line at the right, then a rule. */
export function AboutPageHeader({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mx-auto flex max-w-[1440px] flex-col gap-[30px] px-5 pb-[60px] pt-16 sm:px-10 lg:pt-[100px]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-[30px]">
        <div className="flex flex-col gap-4">
          <p className={eyebrowClass}>A taste of heritage, a spoonful of love</p>
          <h1 className="font-serif text-5xl leading-[1.1] text-primary sm:text-6xl lg:text-[72px]">
            {title}
          </h1>
        </div>
        <p className="leading-[1.6] tracking-[0.35px] text-body lg:w-[440px] lg:shrink-0">
          {children}
        </p>
      </div>
      <div className="h-px w-full bg-line" />
    </section>
  );
}
