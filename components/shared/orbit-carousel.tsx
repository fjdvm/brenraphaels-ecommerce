"use client";

import { useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { pauseYouTubeVideos } from "@/lib/site/pause-youtube-videos";
import { cn } from "@/lib/utils";

export type OrbitItem = { key: string; label: string; content: ReactNode };

/** How far, in px, each item sits from the centre of the ring. */
const RING_RADIUS = 420;

/**
 * Items sit on a 3D ring; Next and Previous turn the ring, so the current item
 * swings away around the back while the next one orbits to the front. Only the
 * front item can be focused, clicked or heard.
 */
export function OrbitCarousel({
  label,
  items,
  stageClassName,
}: {
  label: string;
  items: OrbitItem[];
  /** Sizes the front item, e.g. `max-w-3xl aspect-video`. */
  stageClassName: string;
}) {
  const ring = useRef<HTMLDivElement>(null);
  // Never wrapped, so the ring keeps turning the same way instead of unwinding.
  const [turns, setTurns] = useState(0);
  const count = items.length;
  const active = ((turns % count) + count) % count;
  const step = 360 / count;

  function turnBy(delta: number) {
    if (ring.current) {
      pauseYouTubeVideos(ring.current);
    }
    setTurns((current) => current + delta);
  }

  function goTo(index: number) {
    // The shorter way round the ring.
    let delta = (index - active + count) % count;
    if (delta > count / 2) {
      delta -= count;
    }
    turnBy(delta);
  }

  const arrow =
    "grid size-11 place-items-center bg-primary text-white transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      className="overflow-x-clip"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") turnBy(-1);
        if (event.key === "ArrowRight") turnBy(1);
      }}
    >
      <div
        className={cn(
          "relative mx-auto w-full [perspective:1600px]",
          stageClassName,
        )}
      >
        <div
          ref={ring}
          className="absolute inset-0 transition-transform duration-700 ease-in-out [transform-style:preserve-3d] motion-reduce:transition-none"
          style={{
            transform: `translateZ(-${RING_RADIUS}px) rotateY(${-turns * step}deg)`,
          }}
        >
          {items.map(({ key, content }, index) => (
            <div
              key={key}
              aria-hidden={index !== active}
              inert={index !== active}
              className={cn(
                "absolute inset-0 [backface-visibility:hidden]",
                index !== active && "pointer-events-none",
              )}
              style={{
                transform: `rotateY(${index * step}deg) translateZ(${RING_RADIUS}px)`,
              }}
            >
              {content}
            </div>
          ))}
        </div>
      </div>
      <p
        aria-live="polite"
        className="mt-5 px-2 text-center text-sm text-on-surface-variant"
      >
        <span className="sr-only">{`${active + 1} of ${count}: `}</span>
        {items[active].label}
      </p>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Previous"
          onClick={() => turnBy(-1)}
          className={arrow}
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <div className="flex gap-2">
          {items.map(({ key, label: itemLabel }, index) => (
            <button
              key={key}
              type="button"
              aria-label={`Show ${itemLabel}`}
              aria-current={index === active}
              onClick={() => goTo(index)}
              className={cn(
                "size-2.5 border border-primary transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                index === active
                  ? "bg-primary"
                  : "bg-transparent hover:bg-primary/30",
              )}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Next"
          onClick={() => turnBy(1)}
          className={arrow}
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
    </div>
  );
}
