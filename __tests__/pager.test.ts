import { describe, expect, test } from "vitest";

import { pagerLabel, stepIndex } from "../lib/site/pager";

describe("The About pager", () => {
  test("labels the current position as zero-padded 'NN / NN'", () => {
    expect(pagerLabel(0, 3)).toBe("01 / 03");
    expect(pagerLabel(3, 4)).toBe("04 / 04");
  });

  test("steps forward and back, wrapping around the ends", () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
  });
});
