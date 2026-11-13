"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowLeft, ArrowRight, User } from "lucide-react";

export type CustomerMessage = {
  src: string;
  place: string;
  quote: string;
  alt: string;
};

const arrowClass =
  "grid size-11 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** A quote card beside the customer's screenshot; the arrows step through the messages. */
export function KindWords({ messages }: { messages: CustomerMessage[] }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const message = messages[index];
  const step = (by: number) => {
    setDirection(by > 0 ? "next" : "previous");
    setIndex((index + by + messages.length) % messages.length);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_420px]">
      <div className="flex min-h-[420px] flex-col justify-between gap-10 bg-primary p-8 sm:p-[60px]">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-primary-fixed-dim">
          Kind words
        </p>
        <div aria-live="polite" className="space-y-4">
          <blockquote
            key={message.src}
            className="kind-words-quote font-serif text-4xl leading-[1.1] text-white sm:text-6xl lg:text-7xl"
          >
            &ldquo;{message.quote}&rdquo;
          </blockquote>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          <span className="grid size-11 place-items-center rounded-full bg-primary-fixed text-primary">
            <User aria-hidden className="size-5" />
          </span>
          <p className="text-sm font-medium text-white">{message.place}</p>
          <p className="ml-auto text-sm text-primary-fixed-dim">
            {String(index + 1).padStart(2, "0")} / {String(messages.length).padStart(2, "0")}
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              aria-label="Previous"
              onClick={() => step(-1)}
              className={`${arrowClass} border border-white text-white hover:bg-white/10`}
            >
              <ArrowLeft aria-hidden className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => step(1)}
              className={`${arrowClass} bg-white text-primary hover:bg-primary-fixed`}
            >
              <ArrowRight aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </div>
      <div className="relative min-h-[420px] overflow-hidden bg-primary-fixed lg:h-[560px]">
        <Image
          key={message.src}
          data-direction={direction}
          src={message.src}
          alt={message.alt}
          fill
          sizes="(min-width: 1024px) 420px, 100vw"
          className="kind-words-image object-contain"
        />
      </div>
    </div>
  );
}
