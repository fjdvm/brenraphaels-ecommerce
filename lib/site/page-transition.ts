/** How long the loading screen stays up, even when the next page is ready sooner. */
export const TRANSITION_MS = 1500;

type ClickModifiers = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
};

/** The pathname a click is heading to if it should show the loading screen, otherwise null. */
export function transitionTarget(
  anchor: { href: string; target: string; download: boolean },
  currentHref: string,
  click: ClickModifiers,
): string | null {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) {
    return null;
  }
  if (anchor.download || (anchor.target && anchor.target !== "_self")) return null;
  const to = new URL(anchor.href);
  const from = new URL(currentHref);
  if (to.origin !== from.origin || to.pathname === from.pathname) return null;
  return to.pathname;
}

/** Milliseconds left of the minimum display time. */
export function remainingMs(startedAt: number, now: number) {
  return Math.max(0, TRANSITION_MS - (now - startedAt));
}
