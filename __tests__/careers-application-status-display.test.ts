import { describe, expect, test } from "vitest";

import { applicationConfirmationStepLabels, applicationStatusDisplay, applicationStepLabels } from "../lib/careers/application-status-display";

describe("applicationStatusDisplay", () => {
  test.each([
    ["Received", "Application received", 1],
    ["Screening", "Under review", 2],
    ["Interview", "Interview scheduled", 3],
    ["Offer", "Offer received", 4],
    ["Hired", "Hired", 5],
  ])("%s reads %s and sits on step %i", (status, label, step) => {
    expect(applicationStatusDisplay(status)).toEqual({ label, step, closed: false });
  });

  test.each([
    ["Rejected", "Not selected"],
    ["Declined", "Offer declined"],
    ["Expired", "Offer expired"],
    ["Withdrawn", "Withdrawn"],
  ])("%s reads %s and is closed", (status, label) => {
    expect(applicationStatusDisplay(status)).toEqual({ label, step: 0, closed: true });
  });

  test("an unknown status falls back to the first step", () => {
    expect(applicationStatusDisplay("New")).toEqual({ label: "Application received", step: 1, closed: false });
  });
});

describe("stepper labels", () => {
  test("the Application page uses five steps", () => {
    expect(applicationStepLabels).toEqual(["Apply", "Review", "Interview", "Offer", "Welcome"]);
  });

  test("the confirmation uses four steps, without Offer", () => {
    expect(applicationConfirmationStepLabels).toEqual(["Apply", "Review", "Interview", "Welcome"]);
  });
});
