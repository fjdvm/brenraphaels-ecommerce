import { ChevronLeft, ChevronRight } from "lucide-react";

/** A square Previous or Next button, meant to sit beside the slides. */
export function CarouselArrow({
  direction,
  onClick,
}: {
  direction: "previous" | "next";
  onClick: () => void;
}) {
  const Icon = direction === "previous" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={direction === "previous" ? "Previous" : "Next"}
      onClick={onClick}
      className="grid size-10 shrink-0 place-items-center bg-primary text-white transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:size-11"
    >
      <Icon aria-hidden className="size-5" />
    </button>
  );
}
