/** A YouTube embed that loads lazily, without cookies until played, and never autoplays; the JS API is on so a carousel can pause it. */
export function YouTubeVideo({ id, title }: { id: string; title: string }) {
  return (
    <div className="aspect-video w-full overflow-hidden bg-black">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1`}
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
