"use client";

import { useState } from "react";

import { Pager } from "@/components/features/about/pager";
import { PhotoTile } from "@/components/features/about/photo-tile";
import { eyebrowClass } from "@/components/features/about/section-heading";
import { stepIndex } from "@/lib/site/pager";

export type Partnership = {
  src: string;
  alt: string;
  title: string;
  text: string;
};

/** A partnership photo beside a lavender story card, paged with arrows. */
export function PartnershipsCarousel({ items }: { items: Partnership[] }) {
  const [active, setActive] = useState(0);
  const item = items[active];

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Strategic partnerships"
      className="flex flex-col gap-5 lg:flex-row"
    >
      <PhotoTile
        src={item.src}
        alt={item.alt}
        sizes="(min-width: 1024px) 780px, 100vw"
        className="h-[320px] sm:h-[420px] lg:h-[560px] lg:flex-1"
      />
      <div className="flex flex-col justify-between gap-10 rounded-[40px] bg-lavender-soft p-8 sm:p-[50px] lg:min-h-[560px] lg:w-[560px] lg:shrink-0">
        <div key={active} className="editorial-swap flex flex-col gap-4">
          <p className={eyebrowClass}>Strategic partnerships</p>
          <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">
            {item.title}
          </h2>
          <p className="leading-[1.6] tracking-[0.35px] text-body">
            {item.text}
          </p>
        </div>
        <Pager
          index={active}
          count={items.length}
          onStep={(delta) =>
            setActive((current) => stepIndex(current, items.length, delta))
          }
        />
      </div>
    </div>
  );
}
