"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";

import { pagerLabel } from "@/lib/site/pager";

const buttonClass =
  "grid size-11 shrink-0 place-items-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** "01 / 03" with Previous and Next buttons. */
export function Pager({
  index,
  count,
  onStep,
}: {
  index: number;
  count: number;
  onStep: (delta: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <p
        aria-live="polite"
        className="text-sm leading-normal tracking-[0.35px] text-muted"
      >
        {pagerLabel(index, count)}
      </p>
      <button
        type="button"
        aria-label="Previous"
        onClick={() => onStep(-1)}
        className={`${buttonClass} border border-line bg-white text-primary hover:border-primary`}
      >
        <ArrowLeft aria-hidden className="size-5" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => onStep(1)}
        className={`${buttonClass} bg-primary text-white hover:bg-primary-container`}
      >
        <ArrowRight aria-hidden className="size-5" />
      </button>
    </div>
  );
}
