/** A YouTube embed that loads lazily, without cookies until played, and never autoplays. */
export function YouTubeVideo({ id, title }: { id: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-full w-full border-0"
      />
    </div>
  );
}
