/** A YouTube embed that loads lazily and without cookies until played; it autoplays only when asked to. */
export function YouTubeVideo({
  id,
  title,
  autoplay = false,
}: {
  id: string;
  title: string;
  autoplay?: boolean;
}) {
  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}${autoplay ? "?autoplay=1" : ""}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </div>
  );
}
