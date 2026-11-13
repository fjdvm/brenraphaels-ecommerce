"use client";

import Image from "next/image";
import { useState } from "react";

import { PhotoViewer, type PhotoViewerItem } from "@/components/ui/photo-viewer";
import { cn } from "@/lib/utils";

const feature = { src: "/images/careers/team.jpg", width: 1290, height: 714, caption: "Team in purple shirts at the kitchen", alt: "The Bren Raphael's team in purple shirts, holding jars of ube jam in the kitchen", position: "object-[55%_center]" };

const tiles = [
  { src: "/images/careers/kitchen-products.jpg", width: 1600, height: 1067, caption: "Products on the kitchen shelf", alt: "Bren Raphael's ube powder, jam and halaya arranged on a wooden shelf", position: "object-[50%_center]" },
  { src: "/images/careers/jam-and-powder.jpg", width: 1200, height: 1800, caption: "Ube jam beside ube powder", alt: "Jars of ube jam beside a bowl of ube powder and fresh purple yam", position: "object-center" },
  { src: "/images/careers/ube-powder.jpg", width: 1200, height: 1800, caption: "Ube powder in a wooden spoon", alt: "A wooden spoon lifting ube powder from a bowl", position: "object-center" },
];

const photos: PhotoViewerItem[] = [feature, ...tiles];

const openerClass =
  "relative block w-full cursor-zoom-in overflow-hidden focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** The hero's image block: the team photo over a row of three product shots; each opens the photo viewer. */
export function HeroImages() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <button
          type="button"
          aria-label={`View photo: ${feature.caption}`}
          onClick={() => setOpenIndex(0)}
          className={cn(openerClass, "col-span-3 aspect-[16/10]")}
        >
          <Image
            src={feature.src}
            alt={feature.alt}
            fill
            priority
            sizes="(min-width: 1024px) 560px, 100vw"
            className={cn("object-cover", feature.position)}
          />
        </button>
        {tiles.map((tile, i) => (
          <button
            key={tile.src}
            type="button"
            aria-label={`View photo: ${tile.caption}`}
            onClick={() => setOpenIndex(i + 1)}
            className={cn(openerClass, "aspect-[4/3]")}
          >
            <Image
              src={tile.src}
              alt={tile.alt}
              fill
              sizes="(min-width: 1024px) 180px, 33vw"
              className={cn("object-cover", tile.position)}
            />
          </button>
        ))}
      </div>
      <PhotoViewer label="Life at Bren Raphael's photos" items={photos} index={openIndex} onIndexChange={setOpenIndex} />
    </>
  );
}
