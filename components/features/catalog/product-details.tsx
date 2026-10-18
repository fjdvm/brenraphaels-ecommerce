import { Plus } from "lucide-react";

import type { ProductDescriptionSection } from "@/lib/catalog/description";

/** The spec sections of a Product's description (ingredients, storage, and so on), each collapsed until opened. */
export function ProductDetails({ sections }: { sections: ProductDescriptionSection[] }) {
  if (sections.length === 0) return null;

  return (
    <div className="divide-y divide-line border-y border-line">
      {sections.map((section) => (
        <details key={section.heading} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-8 font-serif text-lg leading-[1.35] text-ink [&::-webkit-details-marker]:hidden">
            {section.heading}
            <Plus aria-hidden className="size-5 shrink-0 transition-transform group-open:rotate-45" />
          </summary>
          <ul className="mt-3 space-y-2 text-sm leading-6 tracking-wide text-body">
            {section.lines.map((line, index) =>
              line.kind === "label" ? (
                <li key={index} className="pt-2 font-medium text-ink first:pt-0">
                  {line.text}
                </li>
              ) : (
                <li key={index} className="pl-4">
                  • {line.text}
                </li>
              ),
            )}
          </ul>
        </details>
      ))}
    </div>
  );
}
