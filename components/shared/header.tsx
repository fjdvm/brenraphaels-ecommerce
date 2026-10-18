"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Menu, ShoppingCart, X } from "lucide-react";

import { freeShippingThreshold } from "@/lib/site/store-info";
import { shouldShowCustomerSidebar } from "@/components/features/customer/customer-sidebar-routes";

/** The sidebar carries its own sign out, so the header shows one exactly where the sidebar is hidden. */
export function shouldShowHeaderSignOut(pathname: string) {
  return !shouldShowCustomerSidebar(pathname);
}

/** Pages that open on a full-bleed photo; their header floats over it until the visitor scrolls. */
const transparentHeaderPaths = new Set(["/"]);

export function hasTransparentHeader(pathname: string, scrolled: boolean) {
  return transparentHeaderPaths.has(pathname) && !scrolled;
}

/** The Philippine flag, drawn rather than typed as an emoji, which some systems show as plain "PH". */
function PhilippineFlag() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 16"
      className="h-3.5 w-[21px] shrink-0 rounded-[2px]"
    >
      <rect width="24" height="8" fill="#0038a8" />
      <rect y="8" width="24" height="8" fill="#ce1126" />
      <path d="M0 0v16l13.9-8z" fill="#fff" />
      <circle cx="4.2" cy="8" r="1.7" fill="#fcd116" />
    </svg>
  );
}

const aboutLinks = [
  { href: "/journey", label: "Our Journey" },
  { href: "/about", label: "Our Story" },
  { href: "/vision-mission", label: "Our Vision and Mission" },
];

type NavLink = { href: string; label: string };
type NavItem = NavLink | { label: string; children: NavLink[] };

const links: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop" },
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
        className="flex items-center gap-1 transition hover:text-primary"
      >
        {label}
        <ChevronDown
          size={14}
          className={open ? "rotate-180 transition" : "transition"}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 pt-3">
          <div className="min-w-56 overflow-hidden rounded-3xl border border-outline-variant/60 bg-surface py-2 text-on-surface shadow-lg">
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

/** The About Us group in the mobile menu: a toggle that expands its links beneath it. */
function MobileAboutMenu({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavLink[];
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-3 text-sm font-semibold text-on-surface hover:text-primary"
      >
        {label}
        <ChevronDown
          aria-hidden
          size={16}
          className={expanded ? "rotate-180 transition" : "transition"}
        />
      </button>
      {expanded &&
        items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className="block py-2.5 pl-4 text-sm font-semibold text-on-surface-variant hover:text-primary"
          >
            {item.label}
          </Link>
        ))}
    </div>
  );
}

export function Header({
  desktopSession,
  headerSignOut,
  mobileSession,
}: {
  desktopSession: ReactNode;
  headerSignOut?: ReactNode;
  mobileSession: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const floating = transparentHeaderPaths.has(pathname);
  const transparent = hasTransparentHeader(pathname, scrolled) && !open;

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  const showHeaderSignOut = shouldShowHeaderSignOut(pathname);
  return (
    <>
    <div
      data-theme="dark"
      className="flex items-center justify-center gap-2.5 bg-tertiary px-5 py-2.5 text-center text-xs tracking-wide text-white"
    >
      <PhilippineFlag />
      <p>
        Free Shipping on orders over ₱{freeShippingThreshold}
        <Link
          href="/products"
          className="ml-2 font-bold uppercase underline underline-offset-2"
        >
          Shop now
        </Link>
      </p>
    </div>
    <header
      data-theme={transparent ? "dark" : undefined}
      className={`sticky top-0 z-20 border-b transition-colors duration-300 ${
        floating ? "-mb-[89px]" : ""
      } ${
        transparent
          ? "border-transparent bg-transparent text-white"
          : "border-outline-variant/60 bg-surface text-on-surface"
      }`}
    >
      <div className="flex h-[88px] items-center px-5 sm:px-10">
        <Link href="/" className="flex items-center gap-3 md:w-80">
          <Image
            src="/logo.jpeg"
            alt="Bren Raphael's Ube Jam & Halaya"
            width={42}
            height={42}
            className="h-11 w-11 rounded-[14px] object-cover"
          />
          <span>
            <strong
              className={`block font-serif text-lg leading-tight transition-colors duration-300 ${transparent ? "text-white" : "text-primary"}`}
            >
              Bren Raphael&apos;s
            </strong>
            <small
              className={`block text-[10px] font-medium uppercase tracking-[.18em] transition-colors duration-300 ${transparent ? "text-primary-fixed-dim" : "text-on-surface-variant/70"}`}
            >
              Ube Jam &amp; Halaya
            </small>
          </span>
        </Link>
        <nav className="hidden flex-1 items-center justify-center gap-9 text-[15px] md:flex">
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
                className="transition hover:text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden items-center justify-end gap-5 text-[15px] md:flex md:w-80">
          {desktopSession}
          {showHeaderSignOut ? headerSignOut : null}
        </div>
        <div
          className={`ml-auto flex items-center gap-1 md:hidden ${transparent ? "text-white" : "text-primary"}`}
        >
          <Link
            href="/cart"
            aria-label="Cart"
            onClick={() => setOpen(false)}
            className="p-2"
          >
            <ShoppingCart />
          </Link>
          <button
            type="button"
            className="p-2"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t border-outline-variant/60 bg-surface px-5 py-4 md:hidden">
          {links.map((link) =>
            "children" in link ? (
              <MobileAboutMenu
                key={link.label}
                label={link.label}
                items={link.children}
                onNavigate={() => setOpen(false)}
              />
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
          {showHeaderSignOut ? headerSignOut : null}
        </nav>
      )}
    </header>
    </>
  );
}
