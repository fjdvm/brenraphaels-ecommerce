import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/** The closing band shared by every About page, sending visitors on to the shop or the store. */
export function AboutCta() {
  return (
    <section className="mx-auto max-w-[1440px] px-5 pb-[100px] sm:px-10">
      <div className="flex flex-col gap-8 bg-lavender-soft p-8 sm:p-[60px] lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-4 text-primary">
          <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em]">
            Taste the story
          </p>
          <p className="font-serif text-3xl leading-[1.2] sm:text-[40px]">
            Every jar carries a family&apos;s dream.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button asChild variant="pill" size="pill-lg">
            <Link href="/products">
              Shop now <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
          <Button
            asChild
            variant="link"
            size="link-sm"
            className="py-2.5 text-lg font-normal"
          >
            <Link href="/contact">Visit our store</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
