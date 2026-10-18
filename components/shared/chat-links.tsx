import type { ComponentType, SVGProps } from "react";

import { InstagramIcon, MessengerIcon } from "@/components/shared/social-icons";
import { chatLinks } from "@/lib/site/store-info";

const icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "Chat on Messenger": MessengerIcon,
  "Chat on Instagram": InstagramIcon,
};

/** Floating shortcuts to message the shop on Messenger or Instagram. */
export function ChatLinks() {
  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
      {chatLinks.map(({ label, href }) => {
        const Icon = icons[label];
        return (
          <a
            key={label}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="group flex h-12 items-center gap-2 rounded-full bg-primary px-3.5 text-sm font-medium tracking-wide text-white shadow-lg transition hover:bg-primary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {Icon ? <Icon aria-hidden className="size-6 shrink-0" /> : null}
            <span className="hidden sm:inline">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
