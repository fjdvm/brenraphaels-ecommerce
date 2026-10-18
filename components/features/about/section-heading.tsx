import { cn } from "@/lib/utils";

export const eyebrowClass =
  "text-xs font-medium uppercase leading-normal tracking-[0.15em] text-primary";

/** An eyebrow over a 40px serif heading. */
export function SectionHeading({
  eyebrow,
  title,
  className,
}: {
  eyebrow: string;
  title: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <p className={eyebrowClass}>{eyebrow}</p>
      <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">
        {title}
      </h2>
    </div>
  );
}
