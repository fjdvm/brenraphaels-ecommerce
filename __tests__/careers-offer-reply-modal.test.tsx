// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { acceptOfferAction, declineOfferAction, runWithToast } = vi.hoisted(() => ({
  acceptOfferAction: vi.fn(),
  declineOfferAction: vi.fn(),
  runWithToast: vi.fn(async ({ task }: { task: () => Promise<unknown> }) => task()),
}));

vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ acceptOfferAction, declineOfferAction }));
vi.mock("../app/(careers)/careers/_components/action-toast", () => ({ runWithToast }));

import { OfferReplyControls } from "../app/(careers)/careers/_components/offer-reply-controls";

const offer = { monthlyPay: "₱16,000", startDate: "16 Nov 2026", schedule: "Mon–Sat · 6 AM – 3 PM", replyBy: "10 Nov 2026", jobTitle: "Production Assistant" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Offer reply controls", () => {
  test("flag off: controls are disabled, carry the note and send nothing", async () => {
    render(<OfferReplyControls referenceNumber="BR-APP-1" enabled={false} offer={offer} />);
    expect((screen.getByRole("button", { name: /Accept offer/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Decline" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Coming soon\. We'll email you the details\./)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(screen.queryByText("Decline this offer?")).toBeNull();
    expect(acceptOfferAction).not.toHaveBeenCalled();
  });

  test("accept restates the offer and needs the agreement before it sends", async () => {
    acceptOfferAction.mockResolvedValue({ ok: true });
    render(<OfferReplyControls referenceNumber="BR-APP-1" enabled offer={offer} />);
    await userEvent.click(screen.getByRole("button", { name: /Accept offer/ }));
    expect(screen.getByText("Accept this offer?")).toBeTruthy();
    for (const text of ["Production Assistant", "₱16,000", "16 Nov 2026", "Mon–Sat · 6 AM – 3 PM"]) expect(screen.getAllByText(new RegExp(text)).length).toBeGreaterThan(0);
    const confirm = screen.getByRole("button", { name: /Yes, accept offer/ }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(confirm);
    await waitFor(() => expect(acceptOfferAction).toHaveBeenCalledTimes(1));
    expect((acceptOfferAction.mock.calls[0][0] as FormData).get("referenceNumber")).toBe("BR-APP-1");
    expect(screen.queryByText("Accept this offer?")).toBeNull();
  });

  test("Not yet closes without sending", async () => {
    render(<OfferReplyControls referenceNumber="BR-APP-1" enabled offer={offer} />);
    await userEvent.click(screen.getByRole("button", { name: /Accept offer/ }));
    await userEvent.click(screen.getByRole("button", { name: "Not yet" }));
    expect(screen.queryByText("Accept this offer?")).toBeNull();
    expect(acceptOfferAction).not.toHaveBeenCalled();
  });

  test("decline takes an optional reason", async () => {
    declineOfferAction.mockResolvedValue({ ok: true });
    render(<OfferReplyControls referenceNumber="BR-APP-1" enabled offer={offer} />);
    await userEvent.click(screen.getByRole("button", { name: "Decline" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, decline offer" }));
    await waitFor(() => expect(declineOfferAction).toHaveBeenCalledTimes(1));
    expect((declineOfferAction.mock.calls[0][0] as FormData).get("reason")).toBe("");
  });
});
