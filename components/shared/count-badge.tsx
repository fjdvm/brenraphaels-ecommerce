/** The count pinned to a header icon's corner; nothing at zero. The link around it says the number aloud. */
export function CountBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span
      aria-hidden
      className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-4 text-white"
    >
      {count > 99 ? "99+" : count}
    </span>
  ) : null;
}
