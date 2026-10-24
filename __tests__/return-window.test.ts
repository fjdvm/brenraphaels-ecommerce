import { expect, test } from "vitest";

import { validateReturnForm } from "../lib/returns/return-form";
import { returnWindow } from "../lib/returns/return-window";

const delivered = Date.parse("2026-10-24T08:00:00Z");

test.each([
  [0, { state: "open", timeLeft: "24h 0m left" }],
  [60_000, { state: "open", timeLeft: "23h 59m left" }],
  [23 * 3_600_000 + 15 * 60_000, { state: "open", timeLeft: "45m left" }],
  [24 * 3_600_000 - 1, { state: "open", timeLeft: "1m left" }],
  [24 * 3_600_000, { state: "closed" }],
])("window %i ms after delivery", (elapsed, expected) => {
  expect(returnWindow(delivered, delivered + elapsed)).toEqual(expected);
});

const valid = { orderLineIds: [1], reason: "damaged" as const, note: "", photos: [{ type: "image/png", size: 10 }],
  video: null, preferredResolution: "refund" as const };

test("a complete form has no errors", () => expect(validateReturnForm(valid)).toEqual({}));

test("each missing or wrong field is named", () => {
  expect(validateReturnForm({ ...valid, orderLineIds: [], reason: "", photos: [], preferredResolution: "" }))
    .toEqual({ orderLineIds: expect.any(String), reason: expect.any(String), photos: "Attach one to three photos.", preferredResolution: expect.any(String) });
  expect(validateReturnForm({ ...valid, photos: [{ type: "image/gif", size: 10 }] }).photos).toBe("Photos must be JPG or PNG.");
  expect(validateReturnForm({ ...valid, photos: [{ type: "image/png", size: 5 * 1024 * 1024 + 1 }] }).photos).toBe("Photos must be 5 MB or smaller.");
  expect(validateReturnForm({ ...valid, photos: Array(4).fill(valid.photos[0]) }).photos).toBe("Attach one to three photos.");
  expect(validateReturnForm({ ...valid, video: { type: "video/webm", size: 10 } }).video).toBe("Videos must be MP4 or MOV.");
  expect(validateReturnForm({ ...valid, video: { type: "video/mp4", size: 25 * 1024 * 1024 + 1 } }).video).toBe("Videos must be 25 MB or smaller.");
  expect(validateReturnForm({ ...valid, note: "<b>" }).note).toMatch(/angle brackets/);
});
