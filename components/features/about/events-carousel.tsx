"use client";

import { useState } from "react";

import { Pager } from "@/components/features/about/pager";
import { PhotoShade, PhotoTile } from "@/components/features/about/photo-tile";
import { SectionHeading } from "@/components/features/about/section-heading";
import { stepIndex } from "@/lib/site/pager";

export type EventFeature = {
  src: string;
  alt: string;
  badge: string;
  title: string;
  text: string;
};

/** One event features large while the next two sit beside it; the arrows move on to the next. */
export function EventsCarousel({ items }: { items: EventFeature[] }) {
  const [active, setActive] = useState(0);
  const feature = items[active];
  const beside = [1, 2].map(
    (offset) => items[stepIndex(active, items.length, offset)],
  );

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Events and features"
      className="flex flex-col gap-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-x-[30px] gap-y-6">
        <SectionHeading
          eyebrow="Events & features"
          title="From local showcases to national features."
        />
        <Pager
          index={active}
          count={items.length}
          onStep={(delta) =>
            setActive((current) => stepIndex(current, items.length, delta))
          }
        />
      </div>
      <div className="flex flex-col gap-5 lg:flex-row">
        <PhotoTile
          src={feature.src}
          alt={feature.alt}
          sizes="(min-width: 1024px) 900px, 100vw"
          className="min-h-[420px] lg:h-[520px] lg:flex-1"
        >
          <PhotoShade />
          <div
            key={active}
            className="editorial-swap absolute inset-x-6 bottom-6 flex flex-col items-start gap-3 sm:inset-x-[50px] sm:bottom-[50px] lg:max-w-[570px]"
          >
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium leading-[1.4] tracking-[0.35px] text-white">
              {feature.badge}
            </span>
            <h3 className="font-serif text-3xl leading-[1.2] text-white sm:text-[40px]">
              {feature.title}
            </h3>
            <p className="leading-[1.6] tracking-[0.35px] text-white">
              {feature.text}
            </p>
          </div>
        </PhotoTile>
        <div className="flex flex-col gap-5 lg:w-[440px] lg:shrink-0">
          {beside.map((item, position) => (
            <PhotoTile
              key={`${active}-${position}`}
              src={item.src}
              alt={item.alt}
              sizes="(min-width: 1024px) 440px, 100vw"
              className="h-[250px]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
