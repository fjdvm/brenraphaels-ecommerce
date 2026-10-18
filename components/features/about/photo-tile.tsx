import { ImageIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A rounded photo slot. Without a `src` it shows the lavender placeholder
 * with its caption, until the real photo is supplied.
 */
export function PhotoTile({
  src,
  alt,
  sizes,
  priority,
  className,
  imageClassName,
  children,
}: {
  src?: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  imageClassName?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[40px] bg-[linear-gradient(135deg,#e9ddfb_0%,#c9a8f0_71.4%)]",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imageClassName)}
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4 text-center text-primary"
        >
          <ImageIcon aria-hidden className="size-7" strokeWidth={1.5} />
          <p className="text-xs tracking-[0.35px]">{alt}</p>
        </div>
      )}
      {children}
    </div>
  );
}

/** Darkens the bottom of a photo so white text over it stays readable. */
export function PhotoShade() {
  return (
    <div
      aria-hidden
      className="absolute inset-0 bg-gradient-to-b from-[rgba(43,26,69,0)] from-30% to-[rgba(43,26,69,0.85)]"
    />
  );
}
