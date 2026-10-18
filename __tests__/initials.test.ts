import { expect, test } from "vitest";

import { initialsOf } from "../lib/customer/initials";

test.each([
  ["Jude Martin", "JM"],
  ["Maria Santos Reyes", "MR"],
  ["jude", "J"],
  ["  ", "?"],
])("%j → %s", (name, initials) => {
  expect(initialsOf(name)).toBe(initials);
});
