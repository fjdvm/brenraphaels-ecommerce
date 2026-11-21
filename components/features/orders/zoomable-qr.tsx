"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PhotoViewer } from "@/components/ui/photo-viewer";

/** Saves the QR as a file; falls back to opening it when the storage address does not allow a direct download. */
async function saveQr(src: string, name: string) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error("download failed");
    const url = URL.createObjectURL(await response.blob());
    const link = Object.assign(document.createElement("a"), { href: url, download: name });
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    window.open(src, "_blank", "noopener");
  }
}

/** A payment account's QR code, shown large below the account details so it is easy to scan; click to enlarge, or download it. */
export function ZoomableQr({ src, label }: { src: string; label: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const alt = `QR for ${label}`;
  return (
    <>
      <div className="flex flex-col items-center gap-3 border-t border-line pt-4">
        <button aria-label={`Enlarge ${alt}`} className="cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" onClick={() => setIndex(0)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed address, never optimised or cached */}
          <img alt={alt} className="size-64 max-w-full border border-line object-contain sm:size-72" src={src} />
        </button>
        <Button onClick={() => void saveQr(src, `${label.replace(/[^\p{L}\p{N}]+/gu, "-")}-qr.png`)} size="pill-lg" type="button" variant="pill-outline">
          <Download aria-hidden className="size-[18px]" strokeWidth={1.5} />
          Download QR
        </Button>
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
