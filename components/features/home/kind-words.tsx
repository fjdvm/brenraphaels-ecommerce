"use client";

import { animate } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type Review = { name: string; source: string; message: string };

const reviews: Review[] = [
  {
    name: "Ira Claire G.",
    source: "Messenger",
    message: "Thank you so much po, it did not disappoint! Masarap po yung halaya di sobrang tamis 💜",
  },
  {
    name: "Rochelle R.",
    source: "Booth at Robinsons",
    message:
      "Hello po aq po ung bmli khpon s booth nyo sa robinson sbrang srap tlga ng ube halaya nyo ubos po agd ung naka llanera kgbi..nkakabitin po ☺️ next time ddgdgan q n po bblhn q s inyo..ngbabalak din po aq magreseller 🙂",
  },
  { name: "@missritadaniela", source: "Instagram", message: "SOOOO GOOD! Definitely!!!" },
  {
    name: "Verified customer",
    source: "Messenger, pickup",
    message: "Salamat mam. Worth the long hunt 😁👌 may pa take-home freetaste pa",
  },
  {
    name: "Verified customer",
    source: "Messenger, with order photo",
    message: "Hi po. Feedback lang po, ang saraaaaap po ng ube. Will definitely order again. Thank you po.",
  },
];

// Each lane lists the reviews in its own order and loops at its own pace (seconds per loop), as in Figma.
const lanes = [
  { seconds: 48, order: [0, 1, 2, 3, 4], className: "hidden lg:block" },
  { seconds: 60, order: [4, 2, 0, 1, 3], className: "hidden lg:block" },
  { seconds: 72, order: [2, 3, 1, 4, 0], className: "hidden lg:block" },
  { seconds: 60, order: [0, 3, 4, 1, 2], className: "lg:hidden" },
];

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

/** Follows the visitor's reduced-motion setting live, so turning it on stops the scroll straight away. */
function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const query = window.matchMedia(reducedMotionQuery);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

// Matches `gap-4` between the cards.
const gap = 16;

/** Loops a lane's track upward forever, one sequence at a time; the second copy makes the loop seamless. */
function Lane({
  seconds,
  order,
  className,
  paused,
}: {
  seconds: number;
  order: number[];
  className: string;
  paused: boolean;
}) {
  const track = useRef<HTMLUListElement>(null);
  const controls = useRef<ReturnType<typeof animate> | null>(null);
  const pausedRef = useRef(paused);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const element = track.current;
    if (!element || reduceMotion || window.matchMedia(reducedMotionQuery).matches) return;
    let distance = 0;
    const start = () => {
      // The track holds two identical sequences: move by one sequence plus the gap before the second begins.
      if (element.scrollHeight === 0) {
        controls.current?.cancel();
        controls.current = null;
        element.style.transform = "";
        distance = 0;
        return;
      }
      const next = (element.scrollHeight + gap) / 2;
      if (next === distance) return;
      distance = next;
      controls.current?.cancel();
      controls.current = animate(element, { y: [0, -distance] }, { duration: seconds, ease: "linear", repeat: Infinity });
      if (pausedRef.current) controls.current.pause();
    };
    const observer = new ResizeObserver(start);
    observer.observe(element);
    start();
    return () => {
      observer.disconnect();
      controls.current?.cancel();
      controls.current = null;
      element.style.transform = "";
    };
  }, [seconds, reduceMotion]);

  useEffect(() => {
    pausedRef.current = paused;
    if (paused) controls.current?.pause();
    else controls.current?.play();
  }, [paused]);

  return (
    <div className={`overflow-clip ${className}`}>
      <ul ref={track} className="reviews-track flex flex-col gap-4">
        {[...order, ...order].map((review, position) => (
          <li
            key={position}
            aria-hidden={position >= order.length || undefined}
            className={`border border-line bg-white p-6 lg:p-7 ${position >= order.length ? "reviews-copy" : ""}`}
          >
            <figure className="flex flex-col items-start gap-3.5">
              <figcaption className="contents">
                <span className="font-serif text-lg leading-[1.35] text-ink">{reviews[review].name}</span>
                <span className="w-full bg-lavender-soft px-2 py-1 text-xs leading-[1.5] tracking-[0.35px] text-primary">
                  {reviews[review].source}
                </span>
              </figcaption>
              <blockquote className="leading-[1.6] tracking-[0.35px] text-body">{reviews[review].message}</blockquote>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Customer reviews scrolling past in lanes; hovering or focusing them pauses the scroll in place. */
export function KindWords() {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  return (
    <div className="space-y-7 lg:space-y-10">
      <div className="space-y-3 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary">Kind words</p>
        <h2 className="font-serif text-[28px] leading-[1.25] text-ink lg:text-[54px] lg:leading-[1.2]">Loved by ube lovers</h2>
        <p className="leading-[1.6] tracking-[0.35px] text-muted">
          Real messages from our customers on Social Media and at our booths.
        </p>
      </div>
      <div
        role="region"
        aria-label="Customer reviews"
        tabIndex={0}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="reviews-viewport relative h-[610px] overflow-clip focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary lg:h-[600px]"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {lanes.map((lane, index) => (
            <Lane key={index} {...lane} paused={paused} />
          ))}
        </div>
        <div aria-hidden className="reviews-fade pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-surface to-transparent" />
        <div aria-hidden className="reviews-fade pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
      </div>
    </div>
  );
}
