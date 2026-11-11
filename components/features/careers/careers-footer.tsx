import Link from "next/link";

import { CareersLogo } from "@/components/features/careers/careers-logo";

const links = [
  { href: "/", label: "Visit the shop" },
  { href: "/about", label: "Our story" },
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact us" },
];

export function CareersFooter() {
  return (
    <footer data-theme="dark" className="mt-auto bg-tertiary text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-[30px] sm:px-10 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-4">
        <CareersLogo inverse />
        <p className="text-xs tracking-[0.35px] text-white/70 max-lg:order-3">
          &copy; 2026 Bren Raphael&apos;s Ube Jam &amp; Halaya · Careers
        </p>
        <nav
          aria-label="Careers footer"
          className="flex flex-wrap gap-x-6 gap-y-2 max-lg:order-2 lg:ml-auto"
        >
          {links.map(({ href, label }) => (
            <Link
              key={label}
              href={href}
              className="text-xs tracking-[0.35px] text-white/85 transition hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
