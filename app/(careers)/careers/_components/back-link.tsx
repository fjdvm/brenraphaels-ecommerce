import Link from "next/link";
import type { ReactNode } from "react";

/** A plain link back to a fixed path, not the browser's history stack: history can
 * hold pages from outside this app (an emailed link opened in a fresh tab, a search
 * result), so `router.back()` doesn't reliably return to where the Applicant actually
 * came from within Careers. */
export function BackLink({
  href,
  className,
  children = "Back",
}: {
  href: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
