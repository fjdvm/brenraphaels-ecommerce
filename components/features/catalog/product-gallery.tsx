"use client";

import Image from "next/image";
import { useState } from "react";

type GalleryImage = { url: string; alt: string };

/** One large Product photo with a thumbnail strip to switch between photos. */
export function ProductGallery({ images }: { images: GalleryImage[] }) {
  const [active, setActive] = useState(0);
  const count = images.length;

  return (
    <div role="group" aria-roledescription="carousel" aria-label="Product photos" className="flex flex-col gap-5">
      <div className="relative aspect-square w-full overflow-hidden rounded-[40px] bg-lavender-soft lg:aspect-auto lg:h-[700px]">
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
      </div>
      {count > 1 && (
        <div className="grid grid-cols-4 gap-3 sm:gap-5">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              aria-label={`Show photo ${index + 1} of ${count}`}
              aria-current={index === active}
              onClick={() => setActive(index)}
              className={`relative aspect-square overflow-hidden rounded-[24px] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:rounded-[40px] ${
                index === active ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"
              }`}
            >
              <Image src={image.url} alt="" fill sizes="12vw" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
