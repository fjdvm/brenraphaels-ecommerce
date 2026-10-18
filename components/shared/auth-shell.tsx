import { Check } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

const perks = [
  "Track orders and submit GCash payments",
  "Chat with our team through Support",
  "Save addresses for faster checkout",
];

/** Split-screen frame for the sign-in, sign-up and password pages: brand panel and form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-[minmax(0,680px)_1fr]">
      <aside
        data-theme="dark"
        className="flex flex-col justify-between gap-10 bg-tertiary px-5 py-6 text-white sm:px-8 lg:sticky lg:top-0 lg:h-screen lg:px-[60px] lg:py-[50px]"
      >
        <Link
          href="/"
          aria-label="Bren Raphael's home page"
          className="flex w-fit items-center gap-3"
        >
          <Image
            src="/logo.jpeg"
            alt=""
            width={56}
            height={56}
            className="size-14 rounded-[14px] object-cover"
          />
          <span>
            <strong className="block font-serif text-xl font-normal leading-[1.3]">
              Bren Raphael&apos;s
            </strong>
            <small className="block text-[10px] font-medium uppercase leading-normal tracking-[0.18em] text-tertiary-fixed-dim">
              Ube Jam &amp; Halaya
            </small>
          </span>
        </Link>

        <div className="hidden flex-col gap-6 lg:flex">
          <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-tertiary-fixed-dim">
            A taste of heritage, a spoonful of love
          </p>
          <p className="font-serif text-[54px] leading-[1.2]">
            Real purple yam, made the heritage way.
          </p>
          <p className="max-w-[440px] leading-[1.6] tracking-[0.35px] text-white/80">
            Artisanal Filipino ube jam and halaya, handcrafted for your table.
          </p>
          <ul className="flex flex-col gap-3.5 pt-4">
            {perks.map((perk) => (
              <li key={perk} className="flex items-center gap-3 leading-[1.6] tracking-[0.35px]">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/[0.14]">
                  <Check aria-hidden className="size-3.5" />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-xs tracking-[0.35px] text-white/55 lg:block">
          &copy; 2026 Bren Raphael&apos;s Ube Jam &amp; Halaya
        </p>
      </aside>

      <div className="flex items-start justify-center bg-surface px-5 py-10 sm:px-8 lg:items-center lg:py-10">
        {children}
      </div>
    </div>
  );
}
