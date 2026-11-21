"use client";

import { useState } from "react";

import { PhotoViewer } from "@/components/ui/photo-viewer";

/** A payment account's QR code, shown small beside the account details; click to enlarge. */
export function ZoomableQr({ src, label }: { src: string; label: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const alt = `QR for ${label}`;
  return (
    <>
      <div className="flex flex-col items-center border-t border-line pt-4 sm:shrink-0 sm:border-t-0 sm:pt-0">
        <button aria-label={`Enlarge ${alt}`} className="cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setIndex(0)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address, never optimised or cached */}
          <img alt={alt} className="size-32 max-w-full border border-line object-contain" src={src} />
        </button>
      </div>
      <PhotoViewer
        index={index}
        items={[{
          key: src,
          caption: alt,
          // The signed address has no known size, so the viewer gets a plain image that fills the stage.
          // eslint-disable-next-line @next/next/no-img-element
          stage: <img alt={alt} className="max-h-full max-w-full bg-white object-contain p-4" src={src} />,
          // eslint-disable-next-line @next/next/no-img-element
          thumbnail: <img alt="" className="size-full bg-white object-contain" src={src} />,
        }]}
        label={alt}
        noun="QR code"
        onIndexChange={setIndex}
      />
    </>
  );
}
