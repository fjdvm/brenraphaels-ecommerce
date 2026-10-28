import { describe, expect, test } from "vitest";

import { applicationProgress } from "../lib/careers/application-progress";

describe("applicationProgress", () => {
  test.each([
    ["Received", 1],
    ["Screening", 2],
    ["Interview", 3],
    ["Offer", 4],
    ["Hired", 5],
  ])("%s is step %i of 5", (status, step) => {
    expect(applicationProgress(status)).toEqual({ closed: false, step, total: 5 });
  });

  test.each(["Rejected", "Withdrawn", "Declined", "Expired"])("%s shows the closed end state", (status) => {
    expect(applicationProgress(status)).toEqual({ closed: true, step: 0, total: 5 });
  });

  test("an unknown status falls back to the first step", () => {
    expect(applicationProgress("New")).toMatchObject({ closed: false, step: 1 });
  });
});
