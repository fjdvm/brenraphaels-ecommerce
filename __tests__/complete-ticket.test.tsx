// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { completeTicket } = vi.hoisted(() => ({ completeTicket: vi.fn() }));
vi.mock("@/app/(site)/(protected)/support/actions", () => ({ completeTicket }));

import { CompleteTicket } from "@/components/features/support/complete-ticket";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CompleteTicket", () => {
  test("skipping the rating still confirms", async () => {
    completeTicket.mockResolvedValue({ completed: true });
    render(<CompleteTicket label="Yes, it's fixed" ticketId={12} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, it's fixed" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip and confirm" }));

    await waitFor(() => expect(completeTicket).toHaveBeenCalledWith(12, undefined));
  });

  test("sends the stars and comment with the confirmation", async () => {
    completeTicket.mockResolvedValue({ completed: true });
    render(<CompleteTicket label="Yes, it's fixed" ticketId={12} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, it's fixed" }));
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    fireEvent.change(screen.getByLabelText("Comment"), { target: { value: "Quick help" } });
    fireEvent.click(screen.getByRole("button", { name: "Send rating and confirm" }));

    await waitFor(() => expect(completeTicket).toHaveBeenCalledWith(12, { stars: 4, comment: "Quick help" }));
  });

  test("a refusal is shown in plain words and the panel stays open", async () => {
    completeTicket.mockResolvedValue({ message: "This Ticket is completed. Open a new Ticket if you need more help." });
    render(<CompleteTicket label="Yes, it's fixed" ticketId={12} />);

    fireEvent.click(screen.getByRole("button", { name: "Yes, it's fixed" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip and confirm" }));

    expect((await screen.findByRole("alert")).textContent).toContain("This Ticket is completed");
  });
});
