import Link from "next/link";

const links = [
  { href: "/careers#open-roles", label: "Open roles" },
  { href: "/careers#life", label: "Life at Bren Raphael's" },
  { href: "/careers#how-hiring-works", label: "How hiring works" },
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
