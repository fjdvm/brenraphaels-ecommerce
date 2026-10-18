/** The "01 / 03" counter beside a pager's arrows. */
export function pagerLabel(index: number, count: number) {
  return `${String(index + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
}

/** The index `delta` steps from `index`, wrapping around either end. */
export function stepIndex(index: number, count: number, delta: number) {
  return (((index + delta) % count) + count) % count;
}
