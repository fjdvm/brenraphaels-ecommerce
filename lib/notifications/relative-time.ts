const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** "2m ago", "1h ago", or the calendar date once it is more than a day old. */
export function relativeTime(date: Date, now: Date = new Date()) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return monthDay.format(date);
}

const clock = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" });

/** "2:31 PM", in the shop's time zone. */
export function formatClock(date: Date) {
  return clock.format(date);
}
