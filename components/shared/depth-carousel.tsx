"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";

import { CarouselArrow } from "@/components/shared/carousel-arrow";
import { EditorialRow } from "@/components/shared/editorial-row";

export type DepthItem = {
  key: string;
  src: string;
  alt: string;
  /** Shown beside the cards while this card is at the front. */
  text: ReactNode;
};

const CARD_WIDTH = 300;
const CARD_HEIGHT = 420;
const DEPTH = 200;
const TILT_DEG = 20;
const PERSPECTIVE_PX = 1400;
const FALLOFF = 0.2;
const MAX_BLUR_PX = 5;
const DURATION_MS = 700;
const SWIPE_PX = 40;
/** A stage narrower than this stacks fewer, tighter cards so they stay readable. */
const COMPACT_BELOW_PX = 520;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const wrap = (value: number, count: number) =>
  ((value % count) + count) % count;

function spacing(compact: boolean) {
  return compact ? { visible: 2, spread: 40 } : { visible: 3, spread: 64 };
}

/** Runs from -1 (leaving) to count - 1 (about to rejoin at the back). */
const offsetOf = (index: number, at: number, count: number) =>
  wrap(index - at + 1, count) - 1;

/**
 * Where a card sits, given how far it is from the front (`offset`: 0 is the
 * front, positive is behind it, negative is on its way out to the left).
 */
function cardStyle(
  offset: number,
  scale: number,
  compact: boolean,
  count: number,
): CSSProperties {
  const { visible, spread } = spacing(compact);
  const behind = Math.max(0, offset);
  // Fades out to the left, and fades in from the very back as a card rejoins the stack.
  const opacity = Math.min(
    offset < 0 ? Math.max(0, 1 + offset) : 1,
    clamp(count - 1 - offset, 0, 1),
    clamp(visible + 0.5 - offset, 0, 1),
  );
  const x = spread * (offset - visible / 2);
  const z = -DEPTH * offset;
  const tilt = TILT_DEG * clamp(offset, 0, 1);
  const blur = Math.min(MAX_BLUR_PX, (behind / visible) * MAX_BLUR_PX);
  return {
    transform: `translate(-50%, -50%) scale(${scale}) translateX(${x.toFixed(2)}px) translateZ(${z.toFixed(2)}px) rotateY(${tilt.toFixed(3)}deg)`,
    opacity,
    filter: `brightness(${Math.max(0.15, 1 - behind * FALLOFF).toFixed(3)}) blur(${blur.toFixed(2)}px)`,
    zIndex: Math.round(2000 - offset * 20),
    pointerEvents: opacity > 0.05 ? "auto" : "none",
  };
}

/**
 * A stack of cards receding in depth, fanned to one side; Next brings the next
 * card forward and sends the front one off to the left and round to the back.
 * Its text sits beside the cards, and so do the arrows.
 */
export function DepthCarousel({
  label,
  items,
  intro,
  mediaSide,
}: {
  label: string;
  items: DepthItem[];
  /** Static text above the active item's text. */
  intro?: ReactNode;
  mediaSide: "left" | "right";
}) {
  const count = items.length;
  const [active, setActive] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  // Fractional while animating, so the cards can be between two positions.
  const position = useRef(0);
  const frame = useRef(0);
  const layout = useRef({ scale: 1, compact: false });
  const swipe = useRef<{ x: number; swiped: boolean } | null>(null);

  function place(at: number) {
    const { scale, compact } = layout.current;
    cards.current.forEach((card, index) => {
      if (!card) return;
      Object.assign(
        card.style,
        cardStyle(offsetOf(index, at, count), scale, compact, count),
      );
    });
  }

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const compact = width < COMPACT_BELOW_PX;
      const { visible, spread } = spacing(compact);
      const needed = CARD_WIDTH + spread * visible + 24;
      const scale = clamp(width / needed, 0.4, 1);
      layout.current = { scale, compact };
      element.style.height = `${Math.round(CARD_HEIGHT * scale + 40)}px`;
      place(position.current);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
    };
    // `place` only reads refs and `count`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  function goTo(index: number) {
    const next = wrap(index, count);
    if (next === active) return;
    cancelAnimationFrame(frame.current);
    const from = position.current;
    // The shorter way round the ring.
    let delta = wrap(next - from, count);
    if (delta > count / 2) delta -= count;
    const to = from + delta;
    setActive(next);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      position.current = wrap(to, count);
      place(position.current);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      position.current = from + (to - from) * (1 - (1 - t) ** 3);
      place(position.current);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        position.current = wrap(to, count);
        place(position.current);
      }
    };
    frame.current = requestAnimationFrame(tick);
  }

  function onPointerUp(event: PointerEvent) {
    const start = swipe.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX) {
      start.swiped = true;
      goTo(active + (dx < 0 ? 1 : -1));
    }
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") goTo(active - 1);
        if (event.key === "ArrowRight") goTo(active + 1);
      }}
    >
      <EditorialRow
        mediaSide={mediaSide}
        media={
          <div className="flex items-center gap-2 sm:gap-4">
            <CarouselArrow
              direction="previous"
              onClick={() => goTo(active - 1)}
            />
            <div
              ref={stage}
              className="relative min-w-0 flex-1 touch-pan-y select-none"
              style={{ height: CARD_HEIGHT + 40, perspective: PERSPECTIVE_PX }}
              onPointerDown={(event) => {
                swipe.current = { x: event.clientX, swiped: false };
              }}
              onPointerUp={onPointerUp}
            >
              <div className="absolute inset-0 [transform-style:preserve-3d]">
                {items.map(({ key, src, alt }, index) => (
                  <div
                    key={key}
                    ref={(element) => {
                      cards.current[index] = element;
                    }}
                    aria-roledescription="slide"
                    aria-label={`${index + 1} of ${count}`}
                    aria-hidden={index !== active}
                    onClick={() => {
                      if (swipe.current?.swiped) return;
                      goTo(index);
                    }}
                    className="absolute left-1/2 top-1/2 cursor-pointer overflow-hidden border border-outline-variant/50 bg-white shadow-[0_30px_60px_-20px_rgba(0,0,0,0.45)] will-change-transform"
                    style={{
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      ...cardStyle(offsetOf(index, 0, count), 1, false, count),
                    }}
                  >
                    <Image
                      src={src}
                      alt={alt}
                      fill
                      sizes={`${CARD_WIDTH}px`}
                      draggable={false}
                      className="object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
            <CarouselArrow direction="next" onClick={() => goTo(active + 1)} />
          </div>
        }
        text={
          <>
            {intro}
            <div
              key={active}
              aria-live="polite"
              className="editorial-swap mt-8"
            >
              {items[active].text}
            </div>
            <p className="mt-8 font-serif text-sm tracking-widest text-secondary">
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(count).padStart(2, "0")}
            </p>
          </>
        }
      />
    </div>
  );
}
