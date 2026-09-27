"use client";

import Image from "next/image";
import { useState } from "react";

import { CarouselArrow } from "@/components/shared/carousel-arrow";

type GalleryImage = { url: string; alt: string };

/** A single Product photo at a time, with Previous/Next controls, so extra photos don't add page height. */
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const count = images.length;

  function go(delta: number) {
    setActive((current) => (current + delta + count) % count);
  }

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label="Product photos"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-surface-variant/30">
        {images.map((image, index) => (
          <Image
            key={image.url}
            src={image.url}
            alt={image.alt}
            fill
            priority={index === 0}
            sizes="(min-width: 1024px) 45vw, 100vw"
            aria-hidden={index !== active}
            className="object-cover transition-opacity duration-300"
            style={{ opacity: index === active ? 1 : 0, pointerEvents: index === active ? "auto" : "none" }}
          />
        ))}
        {count > 1 && (
          <>
            <div className="absolute inset-y-0 left-2 flex items-center">
              <CarouselArrow direction="previous" onClick={() => go(-1)} />
            </div>
            <div className="absolute inset-y-0 right-2 flex items-center">
              <CarouselArrow direction="next" onClick={() => go(1)} />
            </div>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show photo ${index + 1} of ${count}`}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className={`size-2.5 rounded-full transition ${index === active ? "bg-primary" : "bg-outline-variant"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
