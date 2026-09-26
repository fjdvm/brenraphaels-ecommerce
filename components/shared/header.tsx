"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "Our Story" },
  { href: "/faq", label: "FAQ" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

export function Header({
  desktopAccount,
  mobileAccount,
}: {
  desktopAccount: ReactNode;
  mobileAccount: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant/60 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logo.jpeg"
            alt="Bren Raphael's Ube Jam & Halaya"
            width={42}
            height={42}
            className="h-10 w-10 object-cover"
          />
          <span>
            <strong className="block font-serif text-lg leading-tight text-primary">
              Bren Raphael&apos;s
            </strong>
            <small className="block text-[10px] font-bold uppercase tracking-[.15em] text-secondary">
              Ube Jam &amp; Halaya
            </small>
          </span>
        </Link>
        <nav className="hidden gap-7 text-sm font-semibold text-on-surface-variant md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {desktopAccount}
        <button
          type="button"
          className="p-2 text-primary md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-outline-variant/60 bg-surface px-5 py-4 md:hidden">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block py-3 text-sm font-semibold text-on-surface hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
          {mobileAccount}
        </nav>
      )}
    </header>
  );
}
