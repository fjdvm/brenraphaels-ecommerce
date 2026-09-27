"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, X } from "lucide-react";

const aboutLinks = [
  { href: "/journey", label: "Our Journey" },
  { href: "/about", label: "Our Story" },
  { href: "/vision-mission", label: "Our Vision and Mission" },
];

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };

const links: NavItem[] = [
  { href: "/", label: "Home" },
  { label: "About Us", children: aboutLinks },
  { href: "/faq", label: "FAQ" },
  { href: "/careers", label: "Careers" },
  { href: "/contact", label: "Contact" },
];

/** The About Us menu: opens on hover (or click, for touch and keyboard), closes on Escape or a click away. */
function AboutMenu({ label, items }: { label: string; items: NavLink[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
      } else if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 hover:text-primary"
      >
        {label}
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition" : "transition"}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 pt-3">
          <div className="min-w-56 border border-outline-variant/60 bg-surface py-2 shadow-lg">
            {items.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-5 py-2.5 hover:bg-surface-container-low hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header({
  desktopSession,
  mobileSession,
}: {
  desktopSession: ReactNode;
  mobileSession: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant/60 bg-surface">
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
        <nav className="hidden items-center gap-7 text-sm font-semibold text-on-surface-variant md:flex">
          {links.map((link) =>
            "children" in link ? (
              <AboutMenu
                key={link.label}
                label={link.label}
                items={link.children}
              />
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
        {desktopSession}
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
          {links.map((link) =>
            "children" in link ? (
              <div key={link.label} className="py-3">
                <p className="text-sm font-semibold text-on-surface">
                  {link.label}
                </p>
                {link.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setOpen(false)}
                    className="block py-2.5 pl-4 text-sm font-semibold text-on-surface-variant hover:text-primary"
                  >
                    {child.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-3 text-sm font-semibold text-on-surface hover:text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
          {mobileSession}
        </nav>
      )}
    </header>
  );
}
