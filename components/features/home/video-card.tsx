"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";

import { YouTubeVideo } from "@/components/shared/youtube-video";

export type VideoCardProps = {
  id: string;
  title: string;
  kicker: string;
  headline: string;
};

/** A feature card whose thumbnail turns into the video once played. */
export function VideoCard({ id, title, kicker, headline }: VideoCardProps) {
  const [playing, setPlaying] = useState(false);

  return (
    <article className="flex h-full flex-col overflow-hidden bg-white">
      <div className="relative aspect-video overflow-hidden">
        {playing ? (
          <YouTubeVideo id={id} title={title} autoplay />
        ) : (
          <>
            <Image
              src={`/images/home/video-${id}.jpg`}
              alt={title}
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-on-primary-fixed/40" />
            <button
              type="button"
              aria-label={`Play: ${title}`}
              onClick={() => setPlaying(true)}
              className="absolute left-1/2 top-1/2 grid size-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-primary transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Play aria-hidden className="size-7 fill-current" />
            </button>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 px-[30px] pb-[34px] pt-[30px]">
        <p className="text-xs font-medium uppercase tracking-[0.15em] text-on-surface-variant/70">
          {kicker}
        </p>
        <h3 className="font-serif text-[22px] leading-[1.3] text-on-surface">
          {headline}
        </h3>
        {playing ? null : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="mt-auto inline-flex items-center gap-2.5 self-start py-1.5 text-sm font-medium text-primary hover:underline"
          >
            Watch the video <span aria-hidden>→</span>
          </button>
        )}
      </div>
    </article>
  );
}
