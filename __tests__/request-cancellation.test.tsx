// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { RequestCancellation } from "@/components/features/orders/request-cancellation";

afterEach(cleanup);

test("with no existing request there is no button and no rider text", () => {
  const { container } = render(<RequestCancellation request={null} />);
  expect(container.textContent).toBe("");
  expect(screen.queryByRole("button", { name: "Request cancellation" })).toBeNull();
});

test.each([
  [{ status: "waiting-manager", declineReason: null }, "Cancellation requested"],
  [{ status: "approved", declineReason: null }, "Cancellation approved"],
  [{ status: "declined", declineReason: "Parcel is at your door" }, "Parcel is at your door"],
  [{ status: "cancelled", declineReason: null }, "Order cancelled"],
] as const)("shows a clear status for %o", (request, text) => {
  render(<RequestCancellation request={request} />);
  expect(screen.getByRole("status").textContent).toContain(text);
  expect(screen.queryByRole("button", { name: "Request cancellation" })).toBeNull();
});
