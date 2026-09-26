import Image from "next/image";
import type { ReactNode } from "react";
import { Mail } from "lucide-react";

import { email } from "@/lib/site/store-info";

/** Classic air-mail edging, in the brand's purples. */
const airmail =
  "repeating-linear-gradient(-45deg, #452175 0 14px, #ffffff 14px 28px, #d7baff 28px 42px, #ffffff 42px 56px)";

/**
 * An opened air-mail envelope: the flap up top, the letter on an air-mail
 * edged body, a stamp in the corner and the shop's address on the "To" line.
 */
export function Envelope({ children }: { children: ReactNode }) {
  return (
    <div className="pt-16">
      <div className="relative">
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-full h-16 bg-primary-fixed-dim [clip-path:polygon(0_100%,50%_0,100%_100%)]"
        />
        <div
          className="p-3 shadow-[0_24px_48px_-24px_rgba(41,0,85,0.45)]"
          style={{ backgroundImage: airmail }}
        >
          <div className="bg-white p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-outline-variant/60 pb-5">
              <p className="flex items-center gap-3 text-sm text-on-surface-variant">
                <Mail aria-hidden className="size-5 shrink-0 text-primary" />
                <span>
                  <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
                    To
                  </span>
                  <span className="font-semibold text-primary">
                    Bren Raphael&apos;s &lt;{email}&gt;
                  </span>
                </span>
              </p>
              <div
                aria-hidden
                className="shrink-0 rotate-3 border-2 border-dashed border-primary/60 bg-surface p-1"
              >
                <Image
                  src="/logo.jpeg"
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 object-cover"
                />
              </div>
            </div>
            <div className="pt-6">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
