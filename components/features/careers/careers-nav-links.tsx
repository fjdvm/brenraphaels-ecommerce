"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const guestLinks = [
  { href: "/careers#open-roles", label: "Open roles" },
  { href: "/careers#life", label: "Life at Bren Raphael's" },
];

const applicantLinks = [
  { href: "/careers", label: "Job postings" },
  { href: "/careers/profile", label: "Your profile" },
  { href: "/careers/applications", label: "Your applications" },
];

const linkClass = "rounded-full px-[18px] py-[9px] text-[15px] tracking-[0.35px] text-ink transition hover:bg-lavender-soft";

/** Header links: page anchors for a guest, the three portal tabs (current one highlighted) for an Applicant. */
export function CareersNavLinks({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();

  if (!signedIn) {
    return (
      <>
        {guestLinks.map(({ href, label }) => (
          <Link key={label} href={href} className={cn(linkClass, "px-0 hover:bg-transparent hover:text-primary")}>
            {label}
          </Link>
        ))}
      </>
    );
  }

  return (
    <>
      {applicantLinks.map(({ href, label }) => {
        const current = href === "/careers" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(linkClass, current && "bg-lavender font-medium text-primary hover:bg-lavender")}
          >
            {label}
          </Link>
        );
      })}
    </>
  );
}
