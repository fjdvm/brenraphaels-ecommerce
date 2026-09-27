import Image from "next/image";
import Link from "next/link";

import { address, socialLinks, tagline } from "@/lib/site/store-info";

export function Footer() {
  return (
    <footer className="mt-auto bg-tertiary py-14 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:grid-cols-3 sm:px-8">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/logo.jpeg"
              alt="Bren Raphael's logo"
              width={38}
              height={38}
              className="h-9 w-9 object-cover"
            />
            <div>
              <strong className="block font-serif text-lg">
                Bren Raphael&apos;s
              </strong>
              <small className="text-[10px] font-bold uppercase tracking-[.15em] text-tertiary-fixed-dim">
                Ube Jam &amp; Halaya
              </small>
            </div>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/75">
            {tagline}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-white/75">
            {address}
          </p>
          <div className="mt-4 flex gap-5 text-sm text-white/75">
            {socialLinks.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.15em] text-tertiary-fixed-dim">
            Explore
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <Link href="/journey">Our journey</Link>
            <Link href="/about">Our story</Link>
            <Link href="/vision-mission">Our vision and mission</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/careers">Careers</Link>
          </div>
        </div>
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[.15em] text-tertiary-fixed-dim">
            Customer care
          </h2>
          <div className="mt-4 grid gap-3 text-sm text-white/75">
            <Link href="/contact">Contact</Link>
            <Link href="/returns">Returns &amp; refunds</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </div>
      </div>
      <p className="mx-auto mt-12 max-w-7xl border-t border-white/15 px-5 pt-6 text-xs text-white/60 sm:px-8">
        © {new Date().getFullYear()} Bren Raphael&apos;s Ube Jam &amp; Halaya.
        All rights reserved.
      </p>
    </footer>
  );
}
