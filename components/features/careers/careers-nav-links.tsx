import { Briefcase, CalendarDays, ChevronRight, Heart, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/careers#open-roles", label: "Open roles", icon: Briefcase },
  { href: "/careers#life", label: "Life at Bren Raphael's", icon: Heart },
  { href: "/careers#how-hiring-works", label: "How hiring works", icon: CalendarDays },
];

/** The section links, the same for a guest and an Applicant: each scrolls to its section on the Careers page. */
export function CareersNavLinks() {
  return (
    <>
      {links.map(({ href, label }) => (
        <Link key={label} href={href} className="text-[15px] tracking-[0.35px] text-ink transition hover:text-primary">
          {label}
        </Link>
      ))}
    </>
  );
}

const drawerLinkClass =
  "flex items-center gap-3 rounded-2xl px-4 py-3.5 text-[15px] tracking-[0.35px] text-ink transition hover:bg-lavender";

/** The same links, plus the shop, as the rows of the mobile menu drawer. */
export function CareersDrawerLinks() {
  return (
    <ul className="flex flex-col gap-1">
      {links.map(({ href, label, icon: Icon }) => (
        <li key={label}>
          <Link href={href} className={drawerLinkClass}>
            <Icon aria-hidden className="size-5" />
            <span className="flex-1">{label}</span>
            <ChevronRight aria-hidden className="size-4 text-muted" />
          </Link>
        </li>
      ))}
      <li>
        <Link href="/" target="_blank" rel="noopener noreferrer" className={drawerLinkClass}>
          <Store aria-hidden className="size-5" />
          <span className="flex-1">Visit the shop</span>
          <ChevronRight aria-hidden className="size-4 text-muted" />
        </Link>
      </li>
    </ul>
  );
}
