import Image from "next/image";

import { cn } from "@/lib/utils";

const feature = { src: "/images/careers/team.jpg", alt: "The Bren Raphael's team in purple shirts, holding jars of ube jam in the kitchen", position: "object-[55%_center]" };

const tiles = [
  { src: "/images/careers/kitchen-products.jpg", alt: "Bren Raphael's ube powder, jam and halaya arranged on a wooden shelf", position: "object-[50%_center]" },
  { src: "/images/careers/jam-and-powder.jpg", alt: "Jars of ube jam beside a bowl of ube powder and fresh purple yam", position: "object-center" },
  { src: "/images/careers/ube-powder.jpg", alt: "A wooden spoon lifting ube powder from a bowl", position: "object-center" },
];

/** The hero's image block: the team photo over a row of three product shots. */
export function HeroImages() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4">
      <div className="relative col-span-3 aspect-[16/10] overflow-hidden rounded-[28px]">
        <Image
          src={feature.src}
          alt={feature.alt}
          fill
          priority
          sizes="(min-width: 1024px) 560px, 100vw"
          className={cn("object-cover", feature.position)}
        />
      </div>
      {tiles.map((tile) => (
        <div key={tile.src} className="relative aspect-[4/3] overflow-hidden rounded-[20px]">
          <Image
            src={tile.src}
            alt={tile.alt}
            fill
            sizes="(min-width: 1024px) 180px, 33vw"
            className={cn("object-cover", tile.position)}
          />
        </div>
      ))}
    </div>
  );
}
