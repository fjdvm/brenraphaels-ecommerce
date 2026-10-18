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
    <footer
      data-theme="dark"
      className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-4 bg-tertiary px-5 py-[30px] text-white sm:px-10"
    >
      <CareersLogo inverse />
      <p className="text-xs tracking-[0.35px] text-white/70">
        &copy; 2026 Bren Raphael&apos;s Ube Jam &amp; Halaya · Careers
      </p>
      <nav aria-label="Careers footer" className="ml-auto flex flex-wrap gap-x-6 gap-y-2">
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
    </footer>
  );
}
