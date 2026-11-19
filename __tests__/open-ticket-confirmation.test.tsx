// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { createTicket } = vi.hoisted(() => ({ createTicket: vi.fn() }));

vi.mock("@/app/(site)/(protected)/support/actions", () => ({ createTicket }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { OpenTicketForm } from "@/components/features/support/open-ticket-form";

beforeEach(() => {
  createTicket.mockReset().mockResolvedValue({});
});
afterEach(cleanup);

const orders = [{ id: 8, label: "Order #8 · ₱1,166 · Payment needed" }];

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Subject/), "Payment not reflecting");
  await user.click(screen.getByLabelText("Payment"));
  await user.selectOptions(screen.getByLabelText(/Related order/), "8");
  await user.type(screen.getByLabelText(/Message/), "I paid but it still says payment needed.");
}

describe("Open ticket confirmation", () => {
  test("asks to confirm with a summary and sends nothing until confirmed", async () => {
    const user = userEvent.setup();
    render(<OpenTicketForm orders={orders} />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /Open ticket/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Send this ticket?")).toBeTruthy();
    expect(within(dialog).getByText("Payment not reflecting")).toBeTruthy();
    expect(within(dialog).getByText("Payment")).toBeTruthy();
    expect(within(dialog).getByText("Order #8")).toBeTruthy();
    expect(createTicket).not.toHaveBeenCalled();
  });

  test("Go back closes the dialog without sending", async () => {
    const user = userEvent.setup();
    render(<OpenTicketForm orders={orders} />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /Open ticket/ }));
    await user.click(await screen.findByRole("button", { name: "Go back" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(createTicket).not.toHaveBeenCalled();
  });

  test("Send ticket submits the form", async () => {
    const user = userEvent.setup();
    render(<OpenTicketForm orders={orders} />);
    await fillForm(user);
    await user.click(screen.getByRole("button", { name: /Open ticket/ }));
    await user.click(await screen.findByRole("button", { name: "Send ticket" }));

    await waitFor(() => expect(createTicket).toHaveBeenCalledTimes(1));
    const data = createTicket.mock.calls[0][1] as FormData;
    expect(data.get("subject")).toBe("Payment not reflecting");
  });

  test("does not ask while required fields are missing", async () => {
    const user = userEvent.setup();
    render(<OpenTicketForm orders={orders} />);
    await user.click(screen.getByRole("button", { name: /Open ticket/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createTicket).not.toHaveBeenCalled();
  });
});
