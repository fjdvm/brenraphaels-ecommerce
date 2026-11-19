// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile/feedback" }));
vi.mock("@/app/actions", () => ({ signOut: vi.fn() }));

import { CustomerSidebarNavList } from "@/components/features/customer/customer-sidebar";
import { FeedbackForm } from "@/components/features/feedback/feedback-form";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Feedback tab", () => {
  test("is a Customer sidebar tab linking to its own screen, marked current there", () => {
    render(<CustomerSidebarNavList pathname="/profile/feedback" />);
    const tab = screen.getByRole("link", { name: "Feedback" });
    expect(tab.getAttribute("href")).toBe("/profile/feedback");
    expect(tab.getAttribute("aria-current")).toBe("page");
  });
});

describe("Feedback screen form", () => {
  test("renders inline with no floating button or dialog", () => {
    render(<FeedbackForm />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Submit feedback" })).toBeTruthy();
  });

  test("submits a report to the feedback route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByLabelText("Suggestion"));
    await user.type(screen.getByLabelText("Title"), "Add a wishlist");
    await user.type(screen.getByLabelText("Description"), "It would help me save jams for later.");
    await user.click(screen.getByRole("button", { name: "Submit feedback" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByText(/your feedback has been submitted/)).toBeTruthy();
  });
});
