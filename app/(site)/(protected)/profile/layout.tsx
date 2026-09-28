import type { ReactNode } from "react";
import Link from "next/link";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-[calc(100vh-5rem)] bg-surface-container-low px-5 py-10 sm:px-8 sm:py-14">
      <div>
        <nav
          aria-label="Breadcrumb"
          className="text-sm font-medium text-on-surface-variant"
        >
          <Link className="hover:text-primary" href="/">
            Home
          </Link>
          <span aria-hidden="true" className="px-2 text-outline-variant">
            /
          </span>
          <span className="text-primary">My account</span>
        </nav>
        <h1 className="mt-8 font-serif text-4xl text-primary sm:text-5xl">
          My account
        </h1>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
