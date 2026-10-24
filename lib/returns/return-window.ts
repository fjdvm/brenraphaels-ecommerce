export const returnWindowMs = 24 * 60 * 60 * 1000;

export type ReturnWindow = { state: "open"; timeLeft: string } | { state: "closed" };

/** The Return window runs 24 hours from delivery; the server stays the authority on the exact cutoff. */
export function returnWindow(deliveredAtMs: number, nowMs: number): ReturnWindow {
  const left = deliveredAtMs + returnWindowMs - nowMs;
  if (!Number.isFinite(left) || left <= 0) return { state: "closed" };
  const minutes = Math.ceil(left / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return { state: "open", timeLeft: hours === 0 ? `${rest}m left` : `${hours}h ${rest}m left` };
}
