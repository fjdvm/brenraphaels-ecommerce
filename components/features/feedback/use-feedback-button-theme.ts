import { useEffect, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";

const darkThemeSelector = '[data-theme="dark"]';

/** Matches the feedback button to the element visible beneath its fixed screen position. */
export function useFeedbackButtonTheme(buttonRef: RefObject<HTMLButtonElement | null>) {
  const pathname = usePathname();
  const [hasDarkBackground, setHasDarkBackground] = useState(false);

  useEffect(() => {
    const button = buttonRef.current;
    const darkElements = [...document.querySelectorAll<HTMLElement>(darkThemeSelector)];
    if (!button || darkElements.length === 0) {
      setHasDarkBackground(false);
      return;
    }
    const feedbackButton = button;

    let observer: IntersectionObserver | undefined;
    const intersectingElements = new Set<Element>();

    function observeAtButtonPosition() {
      observer?.disconnect();
      intersectingElements.clear();
      setHasDarkBackground(false);

      const buttonRect = feedbackButton.getBoundingClientRect();
      const pointX = buttonRect.left + buttonRect.width / 2;
      const pointY = buttonRect.top + buttonRect.height / 2;
      const rightMargin = Math.max(0, window.innerWidth - pointX - 1);
      const bottomMargin = Math.max(0, window.innerHeight - pointY - 1);

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) intersectingElements.add(entry.target);
            else intersectingElements.delete(entry.target);
          }
          setHasDarkBackground(intersectingElements.size > 0);
        },
        {
          rootMargin: `-${Math.max(0, pointY)}px -${rightMargin}px -${bottomMargin}px -${Math.max(0, pointX)}px`,
        },
      );

      darkElements.forEach((element) => observer?.observe(element));
    }

    observeAtButtonPosition();
    const resizeObserver = new ResizeObserver(observeAtButtonPosition);
    resizeObserver.observe(feedbackButton);
    window.addEventListener("resize", observeAtButtonPosition);

    return () => {
      observer?.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", observeAtButtonPosition);
    };
  }, [buttonRef, pathname]);

  return hasDarkBackground;
}
