import { Briefcase, FileText, ShoppingCart, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

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
        className="relative isolate flex flex-col justify-between gap-10 overflow-hidden bg-tertiary px-5 py-6 text-white sm:px-8 lg:sticky lg:top-0 lg:h-screen lg:px-[60px] lg:py-[50px]"
      >
        <Image
          src="/images/careers/team.jpg"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 680px, 100vw"
          className="-z-20 object-cover object-[60%_center]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-tertiary/55 via-tertiary/90 via-65% to-tertiary/[0.97]" />

        <div className="flex items-center gap-4">
          <CareersLogo inverse />
          <span aria-hidden className="h-8 w-px bg-white" />
          <Link href="/careers" className="font-serif text-[22px] leading-[1.3]">
            Careers
          </Link>
        </div>

        <div className="hidden flex-col gap-[22px] lg:flex">
          <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-accent">
            Bren Raphael&apos;s Careers
          </p>
          <p className="max-w-[560px] font-serif text-[54px] leading-[1.2]">
            Grow with our small-batch kitchen.
          </p>
          <p className="max-w-[460px] leading-[1.6] tracking-[0.35px] text-white/85">
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

      <div className="flex flex-col items-center justify-center gap-5 bg-surface px-5 py-10 sm:px-8">
        {children}
        <div className="flex w-full max-w-[540px] items-center gap-3 rounded-[3px] bg-lavender-soft px-[18px] py-3.5 text-xs tracking-[0.35px] text-body">
          <ShoppingCart aria-hidden className="size-[18px] shrink-0" />
          <p className="flex-1">Applicant accounts are separate from shop accounts.</p>
          <Link href="/" className="shrink-0 font-medium text-primary underline underline-offset-2">
            Shopping? Go to the shop
          </Link>
        </div>
      </div>
    </div>
  );
}
