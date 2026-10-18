import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/shared/social-icons";

import { address, closedDay, socialLinks, storeSchedule } from "@/lib/site/store-info";

const socialIcons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  Facebook: FacebookIcon,
  Instagram: InstagramIcon,
  TikTok: TikTokIcon,
};

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/products", label: "Ube Powder" },
      { href: "/products", label: "Ube Jam" },
      { href: "/products", label: "Ube Halaya" },
      { href: "/products", label: "All products" },
    ],
  },
  {
    title: "Explore",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/journey", label: "Our journey" },
      { href: "/vision-mission", label: "Vision & mission" },
      { href: "/faq", label: "FAQ" },
      { href: "/careers", label: "Careers" },
    ],
  },
  {
    title: "Customer care",
    links: [
      { href: "/contact", label: "Contact us" },
      { href: "/support", label: "Support tickets" },
      { href: "/returns", label: "Returns & refunds" },
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
    ],
  },
];

const headingClass =
  "text-xs font-medium uppercase tracking-[.15em] text-primary-fixed-dim";
const linkClass = "text-sm tracking-wide text-white transition hover:text-primary-fixed-dim";

export function Footer() {
  return (
    <footer
      data-theme="dark"
      className="mt-auto bg-tertiary px-5 pb-[30px] pt-[60px] text-white sm:px-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-8">
        <p className="font-serif text-4xl leading-[1.2] sm:text-[54px]">
          A taste of heritage,
          <br />a spoonful of love.
        </p>
        <div className="flex gap-3">
          {socialLinks.map(({ label, href }) => {
            const Icon = socialIcons[label];
            return (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="grid size-12 place-items-center rounded-full border border-white transition hover:bg-white/10"
              >
                {Icon ? <Icon aria-hidden className="size-[22px]" /> : label}
              </a>
            );
          })}
        </div>
      </div>
      <hr className="my-[50px] border-white/20" />
      <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_170px_220px] lg:gap-[60px]">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="Bren Raphael's logo"
              width={56}
              height={56}
              className="size-14 rounded-[14px] object-cover"
            />
            <div>
              <strong className="block font-serif text-xl font-normal leading-[1.3]">
                Bren Raphael&apos;s
              </strong>
              <small className="text-[10px] font-medium uppercase tracking-[.18em] text-primary-fixed-dim">
                Ube Jam &amp; Halaya
              </small>
            </div>
          </div>
          <p className="max-w-[340px] text-sm leading-6 tracking-wide">{address}</p>
        </div>
        {columns.map(({ title, links }) => (
          <div key={title} className="space-y-3">
            <h2 className={headingClass}>{title}</h2>
            <ul className="space-y-3">
              {links.map(({ href, label }) => (
                <li key={label}>
                  <Link href={href} className={linkClass}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="space-y-3">
          <h2 className={headingClass}>Visit us</h2>
          <ul className="space-y-3 text-sm tracking-wide">
            {storeSchedule.map(({ days, hours }) => (
              <li key={days}>
                {days} &nbsp;{hours}
              </li>
            ))}
            <li>{closedDay}</li>
          </ul>
        </div>
      </div>
      <hr className="my-[50px] border-white/20" />
      <div className="flex flex-wrap justify-between gap-2 text-xs tracking-wide">
        <p>
          © {new Date().getFullYear()} Bren Raphael&apos;s Ube Jam &amp; Halaya. All
          rights reserved.
        </p>
        <p>Made with real ube from Filipino farmers</p>
      </div>
    </footer>
  );
}
