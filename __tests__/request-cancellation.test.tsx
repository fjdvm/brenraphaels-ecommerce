// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { RequestCancellation } from "@/components/features/orders/request-cancellation";

const fetchMock = vi.fn();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); fetchMock.mockReset(); refresh.mockReset(); });

test("sending shows the spinner at once, posts the reason, then shows the waiting status", async () => {
  let reply!: (r: Response) => void;
  fetchMock.mockReturnValue(new Promise<Response>((resolve) => { reply = resolve; }));
  render(<RequestCancellation orderId={4} request={null} />);
  await userEvent.click(screen.getByRole("button", { name: "Request cancellation" }));
  await userEvent.click(screen.getByRole("button", { name: "Send cancellation request" }));
  expect(screen.getByRole("button", { name: "Sending…" }).getAttribute("aria-busy")).toBe("true");
  expect(fetchMock).toHaveBeenCalledWith("/api/orders/4/cancellation", expect.objectContaining({ body: JSON.stringify({ reason: "I entered the wrong address" }) }));
  reply(Response.json({ status: "waiting-manager" }, { status: 202 }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain("Cancellation requested"));
  expect(refresh).toHaveBeenCalled();
});

test("a refusal is said in plain words and the request can be sent again", async () => {
  fetchMock.mockResolvedValue(Response.json({ error: "Only your dispatched Order can have a cancellation request." }, { status: 409 }));
  render(<RequestCancellation orderId={4} request={null} />);
  await userEvent.click(screen.getByRole("button", { name: "Request cancellation" }));
  await userEvent.click(screen.getByRole("button", { name: "Send cancellation request" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Only your dispatched Order");
  expect((screen.getByRole("button", { name: "Send cancellation request" }) as HTMLButtonElement).disabled).toBe(false);
});

test("Other reason needs text before it can be sent", async () => {
  render(<RequestCancellation orderId={4} request={null} />);
  await userEvent.click(screen.getByRole("button", { name: "Request cancellation" }));
  await userEvent.click(screen.getByLabelText("Other reason"));
  expect((screen.getByRole("button", { name: "Send cancellation request" }) as HTMLButtonElement).disabled).toBe(true);
});

test.each([
  [{ status: "waiting-manager", declineReason: null }, "Cancellation requested"],
  [{ status: "approved", declineReason: null }, "Cancellation approved"],
  [{ status: "declined", declineReason: "Parcel is at your door" }, "Parcel is at your door"],
  [{ status: "cancelled", declineReason: null }, "Order cancelled"],
] as const)("shows a clear status for %o", (request, text) => {
  render(<RequestCancellation orderId={4} request={request} />);
  expect(screen.getByRole("status").textContent).toContain(text);
  expect(screen.queryByRole("button", { name: "Request cancellation" })).toBeNull();
});
