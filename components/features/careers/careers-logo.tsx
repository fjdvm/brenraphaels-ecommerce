import Image from "next/image";
import Link from "next/link";

import { cn } from "@/lib/utils";

/** The brand lockup that links to Careers home; `inverse` is for dark backgrounds. */
export function CareersLogo({ inverse = false, className }: { inverse?: boolean; className?: string }) {
  return (
    <Link
      href="/careers"
      aria-label="Bren Raphael's Careers home"
      className={cn("flex w-fit items-center gap-3", className)}
    >
      <Image src="/logo.jpeg" alt="" width={56} height={56} className="size-14 object-cover" />
      <span>
        <strong
          className={cn(
            "block font-serif text-xl font-normal leading-[1.3]",
            inverse ? "text-white" : "text-primary",
          )}
        >
          Bren Raphael&apos;s
        </strong>
        <small
          className={cn(
            "block text-[10px] font-medium uppercase leading-normal tracking-[0.18em]",
            inverse ? "text-accent" : "text-muted",
          )}
        >
          Ube Jam &amp; Halaya
        </small>
      </span>
    </Link>
  );
}
