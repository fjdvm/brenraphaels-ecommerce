import { describe, expect, test } from "vitest";

import { formatClock, formatDayAndClock, relativeTime } from "../lib/notifications/relative-time";

const now = new Date("2026-10-19T12:00:00Z");

describe("relativeTime", () => {
  test.each([
    ["2026-10-19T11:58:00Z", "2m ago"],
    ["2026-10-19T11:00:00Z", "1h ago"],
    ["2026-10-19T11:59:50Z", "Just now"],
    ["2026-10-16T06:14:00Z", "Oct 16"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(new Date(iso), now)).toBe(expected);
  });
});

describe("formatClock", () => {
  test("reads in the shop's time zone", () => {
    expect(formatClock(new Date("2026-10-16T06:14:00Z"))).toBe("2:14 PM");
  });
});

describe("formatDayAndClock", () => {
  test("reads in the shop's time zone", () => {
    expect(formatDayAndClock(new Date("2026-10-16T06:20:00Z"))).toBe("Oct 16, 2:20 PM");
  });
});
