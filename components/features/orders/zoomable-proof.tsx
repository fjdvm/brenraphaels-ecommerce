"use client";

import { useState } from "react";

import { PhotoViewer } from "@/components/ui/photo-viewer";

/** The Customer's latest uploaded payment screenshot as a small preview; click it to open it large and zoom in. */
export function ZoomableProof({ orderId, version }: { orderId: number; version?: string | number }) {
  const [index, setIndex] = useState<number | null>(null);
  // The address is the same for every proof, so a version makes the browser fetch the newest one instead of keeping the first.
  const src = `/api/orders/${orderId}/payment-proof${version === undefined ? "" : `?v=${version}`}`;
  const alt = "Your payment screenshot";
  return (
    <>
      <button aria-label={`Enlarge ${alt.toLowerCase()}`} className="w-fit cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setIndex(0)} type="button">
        {/* eslint-disable-next-line @next/next/no-img-element -- served through a redirect to a short-lived signed address */}
        <img alt={alt} className="h-32 w-auto max-w-full border border-line object-contain" src={src} />
      </button>
      <PhotoViewer
        index={index}
        items={[{
          key: src,
          caption: alt,
          // eslint-disable-next-line @next/next/no-img-element
          stage: <img alt={alt} className="max-h-full max-w-full bg-white object-contain" src={src} />,
          // eslint-disable-next-line @next/next/no-img-element
          thumbnail: <img alt="" className="size-full bg-white object-contain" src={src} />,
        }]}
        label={alt}
        noun="payment screenshot"
        onIndexChange={setIndex}
      />
    </>
  );
}
