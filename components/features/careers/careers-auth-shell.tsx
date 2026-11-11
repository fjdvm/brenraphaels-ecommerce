import { Briefcase, FileText, ShoppingCart, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { CareersAuthMobileHeading } from "@/components/features/careers/careers-auth-mobile-heading";
import { CareersLogo } from "@/components/features/careers/careers-logo";

const perks = [
  { icon: User, label: "Save a reusable applicant profile" },
  { icon: FileText, label: "Upload your résumé once" },
  { icon: Briefcase, label: "Track every application's status" },
];

/** Split-screen frame for the applicant sign-in, sign-up and password pages: the team photo and a form. */
export function CareersAuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,680px)_1fr]">
      <aside
        data-theme="dark"
        className="relative isolate flex flex-col justify-between gap-3 overflow-hidden bg-tertiary px-5 py-7 text-white lg:gap-6 sticky lg:top-0 lg:h-screen lg:px-[60px] lg:py-[50px]"
      >
        <Image
          src="/images/careers/team.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 680px, 100vw"
          className="-z-20 hidden object-cover lg:block object-[60%_center]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 hidden bg-gradient-to-b from-tertiary/55 via-tertiary/90 via-65% to-tertiary/[0.97] lg:block" />

        <div className="flex items-center gap-4">
          <CareersLogo inverse />
          <span aria-hidden className="hidden h-8 w-px bg-white lg:block" />
          <Link href="/careers" className="hidden font-serif text-[22px] leading-[1.3] lg:block">
            Careers
          </Link>
        </div>

        <CareersAuthMobileHeading />

        <div className="hidden flex-col gap-[22px] lg:flex">
          <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-accent">
            Bren Raphael&apos;s Careers
          </p>
          <p className="max-w-[560px] font-serif text-[54px] leading-[1.2]">
            Grow with our small-batch kitchen.
          </p>
          <p className="hidden max-w-[460px] leading-[1.6] tracking-[0.35px] text-white/85 lg:block">
            Create one applicant profile, then apply to any open role in a few clicks.
          </p>
          <ul className="flex flex-col gap-3.5 pt-2.5">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 leading-[1.6] tracking-[0.35px]">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.14]">
                  <Icon aria-hidden className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-xs tracking-[0.35px] text-white/55 lg:block">
          &copy; 2026 Bren Raphael&apos;s Ube Jam &amp; Halaya
        </p>
      </aside>

      <div className="flex flex-col items-center justify-center gap-[18px] bg-surface px-4 pb-8 pt-6 lg:gap-5 lg:px-8 lg:py-10">
        {children}
        <div className="flex w-full max-w-[540px] items-center gap-3 rounded-[20px] bg-lavender-soft px-4 py-3.5 text-xs tracking-[0.35px] text-primary sm:rounded-[3px] sm:px-[18px] sm:text-body">
          <ShoppingCart aria-hidden className="size-4 shrink-0 sm:size-[18px]" />
          <p className="flex-1">Applicant accounts are separate from shop accounts.</p>
          <Link href="/" className="hidden shrink-0 font-medium text-primary underline underline-offset-2 sm:block">
            Shopping? Go to the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
