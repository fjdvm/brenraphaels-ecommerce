"use client";

import { ArrowRight, Play } from "lucide-react";
import { useState } from "react";

import { PhotoTile } from "@/components/features/about/photo-tile";
import { YouTubeVideo } from "@/components/shared/youtube-video";
import { Button } from "@/components/ui/button";

/**
 * A TV feature: a thumbnail that turns into the video once played. Without a
 * video `id` the card shows a placeholder and links to `fallbackHref` instead.
 */
export function MediaCard({
  id,
  thumbnail,
  title,
  kicker,
  headline,
  fallbackHref,
}: {
  id?: string;
  thumbnail?: string;
  title: string;
  kicker: string;
  headline: string;
  fallbackHref: string;
}) {
  const [playing, setPlaying] = useState(false);
  const playButtonClass =
    "grid size-[72px] place-items-center rounded-full bg-white text-primary transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <article className="flex h-full flex-col overflow-hidden bg-white">
      {playing && id ? (
        <YouTubeVideo id={id} title={title} autoplay />
      ) : (
        <PhotoTile
          src={thumbnail}
          alt={title}
          sizes="(min-width: 1024px) 670px, 100vw"
          className="h-[240px] sm:h-[380px]"
        >
          <div aria-hidden className="absolute inset-0 bg-[rgba(43,26,69,0.55)]" />
          <div className="absolute inset-0 grid place-items-center">
            {id ? (
              <button
                type="button"
                aria-label={`Play: ${title}`}
                onClick={() => setPlaying(true)}
                className={playButtonClass}
              >
                <Play aria-hidden className="size-8" />
              </button>
            ) : (
              <a
                href={fallbackHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Watch: ${title}`}
                className={playButtonClass}
              >
                <Play aria-hidden className="size-8" />
              </a>
            )}
          </div>
        </PhotoTile>
      )}
      <div className="flex flex-1 flex-col items-start gap-3 px-8 pb-10 pt-[34px] sm:px-10">
        <p className="text-xs font-medium uppercase leading-normal tracking-[0.15em] text-muted">
          {kicker}
        </p>
        <h3 className="font-serif text-2xl leading-[1.25] text-ink sm:text-[28px]">
          {headline}
        </h3>
        {playing && id ? null : id ? (
          <Button type="button" variant="pill" size="pill-sm" className="mt-auto" onClick={() => setPlaying(true)}>
            Watch the video <ArrowRight aria-hidden className="size-4" />
          </Button>
        ) : (
          <Button asChild variant="pill" size="pill-sm" className="mt-auto">
            <a href={fallbackHref} target="_blank" rel="noopener noreferrer">
              Watch the video <ArrowRight aria-hidden className="size-4" />
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}
