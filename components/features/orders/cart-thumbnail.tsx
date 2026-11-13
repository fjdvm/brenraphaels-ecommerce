import Image from "next/image";

/** A Cart line's Product photo, or a soft lavender tile for lines that have none. */
export function CartThumbnail({ url, size }: { url?: string | null; size: 64 | 120 }) {
  const box = size === 120 ? "size-[88px] sm:size-[120px]" : "size-16";
  return (
    <div className={`relative ${box} shrink-0 overflow-hidden bg-gradient-to-br from-[#e9ddfb] to-[#c9a8f0]`}>
      {url ? <Image src={url} alt="" fill sizes={`${size}px`} className="object-cover" /> : null}
    </div>
  );
}
