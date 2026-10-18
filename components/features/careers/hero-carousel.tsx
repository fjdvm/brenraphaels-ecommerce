"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const slides = [
  { src: "/images/careers/team.jpg", alt: "The Bren Raphael's team in purple shirts, holding jars of ube jam in the kitchen", position: "object-[55%_center]" },
  { src: "/images/careers/kitchen-products.jpg", alt: "Bren Raphael's ube powder, jam and halaya arranged on a wooden shelf", position: "object-[50%_center]" },
  { src: "/images/careers/jam-and-powder.jpg", alt: "Jars of ube jam beside a bowl of ube powder and fresh purple yam", position: "object-center" },
  { src: "/images/careers/ube-powder.jpg", alt: "A wooden spoon lifting ube powder from a bowl", position: "object-center" },
];

const interval = 5000;

/** The hero tile: the team photo and product shots that cross-fade (with a slow zoom) every few seconds. */
export function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(() => setActive((current) => (current + 1) % slides.length), interval);
    return () => clearTimeout(timer);
  }, [active, paused]);

  return (
    <div
      className="relative min-h-[320px] overflow-hidden rounded-[40px] lg:min-h-[560px]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, index) => (
        <Image
          key={slide.src}
          src={slide.src}
          alt={index === active ? slide.alt : ""}
          aria-hidden={index !== active}
          fill
          priority={index === 0}
          sizes="(min-width: 1024px) 560px, 100vw"
          className={cn(
            "object-cover transition-[opacity,transform] duration-[1400ms] ease-out motion-reduce:transition-none",
            slide.position,
            index === active ? "scale-100 opacity-100" : "scale-110 opacity-0",
          )}
        />
      ))}
      <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.src}
            type="button"
            aria-label={`Show photo ${index + 1} of ${slides.length}`}
            aria-current={index === active}
            onClick={() => setActive(index)}
            className={cn(
              "h-2 rounded-full bg-white/70 shadow transition-all duration-500",
              index === active ? "w-6 bg-white" : "w-2 hover:bg-white",
            )}
          />
        ))}
      </div>
    </div>
  );
}
