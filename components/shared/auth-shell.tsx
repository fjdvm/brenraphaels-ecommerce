import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Split-screen frame for the sign-in and sign-up pages: brand panel and form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <aside className="flex flex-col justify-between gap-10 bg-tertiary px-5 py-6 text-white sm:px-8 lg:sticky lg:top-0 lg:h-screen lg:px-14 lg:py-12">
        <Link
          href="/"
          aria-label="Back to the Bren Raphael's home page"
          className="group flex w-fit items-center gap-3"
        >
          <ArrowLeft
            aria-hidden="true"
            className="h-5 w-5 text-tertiary-fixed-dim transition-transform group-hover:-translate-x-1"
          />
          <Image
            src="/logo.jpeg"
            alt=""
            width={42}
            height={42}
            className="h-10 w-10 object-cover"
          />
          <span>
            <strong className="block font-serif text-lg leading-tight">
              Bren Raphael&apos;s
            </strong>
            <small className="block text-[10px] font-bold uppercase tracking-[.15em] text-tertiary-fixed-dim">
              Ube Jam &amp; Halaya
            </small>
          </span>
        </Link>

        <div className="hidden border-l-2 border-tertiary-fixed-dim pl-5 lg:block">
          <p className="max-w-md font-serif text-4xl leading-tight">
            Real purple yam, made the heritage way.
          </p>
          <p className="mt-3 text-white/70">
            Artisanal Filipino ube jam and halaya, handcrafted for your table.
          </p>
        </div>

        <p className="hidden text-xs text-white/50 lg:block">
          Bren Raphael&apos;s Ube Jam &amp; Halaya
        </p>
      </aside>

      <div className="flex items-start justify-center bg-surface-container-low px-5 py-10 sm:px-8 lg:items-center lg:py-14">
        {children}
      </div>
    </div>
  );
}
