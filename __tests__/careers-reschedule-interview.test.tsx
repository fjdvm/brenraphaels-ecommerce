// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const { requestRescheduleAction, runWithToast } = vi.hoisted(() => ({
  requestRescheduleAction: vi.fn(),
  runWithToast: vi.fn(async ({ task }: { task: () => Promise<unknown> }) => task()),
}));

vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ requestRescheduleAction }));
vi.mock("../app/(careers)/careers/_components/action-toast", () => ({ runWithToast }));

import { RescheduleInterview } from "../app/(careers)/careers/_components/reschedule-interview";
import { DatePicker } from "../components/ui/date-picker";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Date picker", () => {
  test("past days are disabled and cannot be chosen", async () => {
    const onChange = vi.fn();
    render(<DatePicker value="" onChange={onChange} min="2026-11-12" />);
    expect((screen.getByRole("button", { name: "11 November 2026" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "12 November 2026" }) as HTMLButtonElement).disabled).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "11 November 2026" }));
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "20 November 2026" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-20");
  });

  test("past months and past years cannot be reached", () => {
    render(<DatePicker value="" onChange={vi.fn()} min="2026-11-12" />);
    expect((screen.getByRole("button", { name: "Previous month" }) as HTMLButtonElement).disabled).toBe(true);
    const years = Array.from((screen.getByLabelText("Year") as HTMLSelectElement).options).map((option) => option.value);
    expect(years[0]).toBe("2026");
    expect(years).not.toContain("2025");
    const months = Array.from((screen.getByLabelText("Month") as HTMLSelectElement).options);
    expect(months.find((option) => option.text === "October")?.disabled).toBe(true);
    expect(months.find((option) => option.text === "December")?.disabled).toBe(false);
  });

  test("moving forward a year keeps the view from landing in a past month", async () => {
    render(<DatePicker value="" onChange={vi.fn()} min="2026-11-12" />);
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    await userEvent.click(screen.getByRole("button", { name: "Next month" }));
    expect((screen.getByLabelText("Year") as HTMLSelectElement).value).toBe("2027");
    await userEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect((screen.getByRole("button", { name: "Previous month" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("Reschedule interview", () => {
  test("flag off: visible, disabled, carries the note and sends nothing", async () => {
    render(<RescheduleInterview referenceNumber="BR-APP-1" enabled={false} today="2026-11-12" />);
    const control = screen.getByRole("button", { name: /reschedule/i }) as HTMLButtonElement;
    expect(control.disabled).toBe(true);
    expect(screen.getByText("Coming soon. We'll email you the details.")).toBeTruthy();
    await userEvent.click(control);
    expect(screen.queryByText("Request a new interview time")).toBeNull();
    expect(requestRescheduleAction).not.toHaveBeenCalled();
  });

  test("flag on: needs a day and time, the note is optional, and the request goes through the action", async () => {
    requestRescheduleAction.mockResolvedValue({ ok: true });
    render(<RescheduleInterview referenceNumber="BR-APP-1" enabled today="2026-11-12" />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    expect(screen.getByText("Request a new interview time")).toBeTruthy();
    const send = screen.getByRole("button", { name: "Send request" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "20 November 2026" }));
    expect(send.disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "2:00 PM" }));
    expect(screen.getByText(/Fri, 20 Nov · 2:00 PM/)).toBeTruthy();
    await userEvent.click(send);
    await waitFor(() => expect(requestRescheduleAction).toHaveBeenCalledTimes(1));
    const formData = requestRescheduleAction.mock.calls[0][0] as FormData;
    expect([formData.get("referenceNumber"), formData.get("date"), formData.get("time"), formData.get("note")]).toEqual(["BR-APP-1", "2026-11-20", "14:00", ""]);
    expect(screen.queryByText("Request a new interview time")).toBeNull();
  });

  test("Cancel closes without sending", async () => {
    render(<RescheduleInterview referenceNumber="BR-APP-1" enabled today="2026-11-12" />);
    await userEvent.click(screen.getByRole("button", { name: /reschedule/i }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Request a new interview time")).toBeNull();
    expect(requestRescheduleAction).not.toHaveBeenCalled();
  });
});
