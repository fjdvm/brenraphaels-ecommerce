"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { useRef, type KeyboardEvent, type ReactNode, type TouchEvent } from "react";

import { cn } from "@/lib/utils";

export type PhotoViewerImage = {
  src: string;
  alt: string;
  caption: string;
  /** The photo's natural size, so it is shown at its own aspect ratio. */
  width: number;
  height: number;
  key?: undefined;
};

/** Anything else (a PDF, a file card, a loading or error state) supplies its own stage and thumbnail. */
export type PhotoViewerCustom = {
  key: string;
  caption: string;
  stage: ReactNode;
  thumbnail?: ReactNode;
};

export type PhotoViewerItem = PhotoViewerImage | PhotoViewerCustom;

const itemKey = (item: PhotoViewerItem) => item.key ?? item.src;

type PhotoViewerProps = {
  /** Accessible name of the dialog. */
  label: string;
  items: PhotoViewerItem[];
  /** The photo being shown, or null while the viewer is closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** What the items are called in labels and hints; "photo" by default. */
  noun?: string;
};

const roundButton =
  "flex items-center justify-center rounded-full transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/**
 * Full-screen photo viewer: caption with position, previous/next, thumbnails and close, over a dark scrim.
 * Controlled by `index`; opening and closing is the opener's state, so focus returns to whatever opened it.
 * Shared shell: Documents reuse it with their own items.
 */
export function PhotoViewer({ label, items, index, onIndexChange, noun = "photo" }: PhotoViewerProps) {
  const touchStartX = useRef<number | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const open = index !== null && items[index] !== undefined;
  const current = open ? items[index] : null;
  const last = items.length - 1;
  const goTo = (next: number) => onIndexChange(Math.min(Math.max(next, 0), last));

  function onKeyDown(event: KeyboardEvent) {
    if (index === null) return;
    if (event.key === "ArrowRight") goTo(index + 1);
    else if (event.key === "ArrowLeft") goTo(index - 1);
  }

  function onTouchEnd(event: TouchEvent) {
    if (touchStartX.current === null || index === null) return;
    const dx = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) > 50) goTo(index + (dx < 0 ? 1 : -1));
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(43,27,69,0.96)] sm:bg-[rgba(43,27,69,0.92)]" />
        <DialogPrimitive.Content
          aria-label={label}
          aria-describedby={undefined}
          onKeyDown={onKeyDown}
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            // The opener is outside this dialog; put focus back on it explicitly.
            event.preventDefault();
            opener.current?.focus();
          }}
          className="fixed inset-0 z-50 flex flex-col text-white focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          {current && index !== null && (
            <>
              <div className="flex items-center gap-3 px-5 pb-3 pt-14 sm:px-10 sm:py-6">
                <p className="flex-1 text-sm tracking-[0.35px] text-white sm:text-lavender" aria-live="polite">
                  {`${index + 1} / ${items.length}`}
                  <span className="hidden sm:inline">{` · ${current.caption}`}</span>
                </p>
                <DialogPrimitive.Close
                  aria-label="Close"
                  className={cn(roundButton, "size-10 bg-tertiary sm:size-11")}
                >
                  <X aria-hidden className="size-[18px]" strokeWidth={1.5} />
                </DialogPrimitive.Close>
              </div>

              <div
                data-testid="photo-viewer-stage"
                onClick={(event) => event.target === event.currentTarget && onIndexChange(null)}
                onTouchStart={(event) => (touchStartX.current = event.touches[0].clientX)}
                onTouchEnd={onTouchEnd}
                className="relative flex min-h-0 flex-1 items-center justify-center sm:px-[140px]"
              >
                {index > 0 && (
                  <button
                    type="button"
                    aria-label={`Previous ${noun}`}
                    onClick={() => goTo(index - 1)}
                    className={cn(roundButton, "absolute left-[84px] top-1/2 hidden size-14 -translate-y-1/2 bg-white text-primary sm:flex")}
                  >
                    <ChevronLeft aria-hidden className="size-[22px]" strokeWidth={1.5} />
                  </button>
                )}
                {current.key !== undefined ? (
                  <div key={itemKey(current)} className="flex h-full w-full items-center justify-center">{current.stage}</div>
                ) : (
                  <Image
                    key={current.src}
                    src={current.src}
                    alt={current.alt}
                    width={current.width}
                    height={current.height}
                    sizes="(min-width: 640px) 1000px, 100vw"
                    priority
                    className="h-auto max-h-full w-auto max-w-full rounded-none object-contain sm:rounded-[32px]"
                  />
                )}
                {index < last && (
                  <button
                    type="button"
                    aria-label={`Next ${noun}`}
                    onClick={() => goTo(index + 1)}
                    className={cn(roundButton, "absolute right-[84px] top-1/2 hidden size-14 -translate-y-1/2 bg-white text-primary sm:flex")}
                  >
                    <ChevronRight aria-hidden className="size-[22px]" strokeWidth={1.5} />
                  </button>
                )}
              </div>

              <ul className="hidden justify-center gap-3 px-5 pb-9 pt-5 sm:flex">
                {items.map((item, i) => (
                  <li key={itemKey(item)}>
                    <button
                      type="button"
                      aria-label={`Show ${noun} ${i + 1}: ${item.caption}`}
                      aria-current={i === index ? "true" : undefined}
                      onClick={() => onIndexChange(i)}
                      className={cn(
                        "relative block h-[72px] w-[96px] overflow-hidden rounded-2xl transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
                        i === index ? "border-[3px] border-white" : "opacity-55 hover:opacity-80",
                      )}
                    >
                      {item.key !== undefined ? (
                        (item.thumbnail ?? null)
                      ) : (
                        <Image src={item.src} alt="" fill sizes="96px" className="object-cover" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col items-center gap-5 pb-8 pt-4 sm:hidden">
                <ol aria-hidden className="flex items-center gap-1.5">
                  {items.map((item, i) => (
                    <li
                      key={itemKey(item)}
                      className={cn("h-1.5 rounded-[3px]", i === index ? "w-5 bg-white" : "w-1.5 bg-muted")}
                    />
                  ))}
                </ol>
                <div className="flex w-full flex-col gap-1 px-5 text-sm tracking-[0.35px]">
                  <p className="font-medium text-white">{current.caption}</p>
                  <p className="text-xs text-accent">Swipe for more {noun}s · pinch to zoom</p>
                </div>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
