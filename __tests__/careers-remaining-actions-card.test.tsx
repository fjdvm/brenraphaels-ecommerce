// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const { setApplicantJobAlerts, withdrawApplicationAction, submitApplicationAction, markRead, markAllRead } = vi.hoisted(() => ({
  setApplicantJobAlerts: vi.fn(),
  withdrawApplicationAction: vi.fn(),
  submitApplicationAction: vi.fn(),
  markRead: vi.fn(),
  markAllRead: vi.fn(),
}));

vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ setApplicantJobAlerts }));
vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ withdrawApplicationAction }));
vi.mock("@/app/(careers)/careers/(portal)/[id]/apply/actions", () => ({ submitApplicationAction }));
vi.mock("@/app/(careers)/careers/(portal)/notifications/actions", () => ({ markApplicantNotificationRead: markRead, markAllApplicantNotificationsRead: markAllRead }));

import { CareersToaster } from "@/app/(careers)/careers/_components/action-toast";
import { JobAlertsToggle } from "@/app/(careers)/careers/(portal)/profile/job-alerts-toggle";
import { WithdrawApplication } from "@/app/(careers)/careers/_components/withdraw-application";
import { ApplicantNotificationsFeed } from "@/app/(careers)/careers/(portal)/notifications/applicant-notifications-feed";
import { ApplicationForm } from "@/app/(careers)/careers/(portal)/[id]/apply/application-form";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  // jsdom has no pointer capture, which Sonner's card calls on press.
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLElement.prototype.releasePointerCapture = () => {};
});
afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  cleanup();
});

describe("job-alert toggle", () => {
  test("disables the switch with progress, then shows the result", async () => {
    const gate = deferred<{ jobAlertsOptIn: boolean }>();
    setApplicantJobAlerts.mockReturnValue(gate.promise);
    render(<><CareersToaster /><JobAlertsToggle initial={false} profileSaved /></>);
    await userEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("Saving…")).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => gate.resolve({ jobAlertsOptIn: true }));
    expect(await screen.findByText("Job alerts turned on")).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("switch") as HTMLButtonElement).disabled).toBe(false);
  });

  test("a failure restores the switch and offers Retry, which saves again", async () => {
    setApplicantJobAlerts.mockResolvedValueOnce({ message: "Nope." }).mockResolvedValueOnce({ jobAlertsOptIn: true });
    render(<><CareersToaster /><JobAlertsToggle initial={false} profileSaved /></>);
    await userEvent.click(screen.getByRole("switch"));
    expect(await screen.findByText("Nope.")).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Job alerts turned on")).toBeTruthy();
    expect(setApplicantJobAlerts).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
  });
});

describe("withdraw application", () => {
  async function open() {
    render(<><CareersToaster /><WithdrawApplication referenceNumber="BR-1" /></>);
    await userEvent.click(screen.getByRole("button", { name: "Withdraw application" }));
  }

  test("shows progress with the button disabled, then the result", async () => {
    const gate = deferred<{ ok: true }>();
    withdrawApplicationAction.mockReturnValue(gate.promise);
    await open();
    await userEvent.click(screen.getAllByRole("button", { name: "Withdraw application" }).at(-1)!);
    expect(await screen.findByRole("progressbar")).toBeTruthy();
    expect(screen.queryByText("Withdraw this application?")).toBeNull();
    expect(screen.getByRole("button", { name: "Withdrawing…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => gate.resolve({ ok: true }));
    expect(await screen.findByText("Application withdrawn")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Withdraw application" }).hasAttribute("disabled")).toBe(false);
    expect(withdrawApplicationAction.mock.calls[0][0].get("referenceNumber")).toBe("BR-1");
  });

  test("a failure shows the error with Retry, which sends the same Application again", async () => {
    withdrawApplicationAction.mockResolvedValueOnce({ ok: false, message: "Moved on." }).mockResolvedValueOnce({ ok: true });
    await open();
    await userEvent.click(screen.getAllByRole("button", { name: "Withdraw application" }).at(-1)!);
    expect(await screen.findByText("Moved on.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Application withdrawn")).toBeTruthy();
    expect(withdrawApplicationAction).toHaveBeenCalledTimes(2);
  });
});

describe("notifications read marks", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const item = (id: string) => ({ id, type: "job-posting.opened", title: `Role ${id}`, body: "Open.", link: null, createdAt: new Date("2026-10-28T11:00:00Z"), readAt: null });

  test("mark all as read shows progress, disables the control, then the result", async () => {
    const gate = deferred<{ ok: true }>();
    markAllRead.mockReturnValue(gate.promise);
    render(<><CareersToaster /><ApplicantNotificationsFeed items={[item("a"), item("b")]} now={now} /></>);
    await userEvent.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(await screen.findByText("Marking all as read…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mark all as read" }).hasAttribute("disabled")).toBe(true);
    await act(async () => gate.resolve({ ok: true }));
    expect(await screen.findByText("All marked as read")).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });

  test("a failed read mark puts the row back as unread and offers Retry", async () => {
    markRead.mockResolvedValueOnce({ ok: false, message: "Could not mark." }).mockResolvedValueOnce({ ok: true });
    render(<><CareersToaster /><ApplicantNotificationsFeed items={[item("a")]} now={now} /></>);
    await userEvent.click(screen.getByRole("button", { name: /Role a/ }));
    expect(await screen.findByText("Could not mark.")).toBeTruthy();
    expect(screen.getByText("1 unread")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Marked as read")).toBeTruthy();
    expect(screen.getByText("You're all caught up.")).toBeTruthy();
  });
});

describe("submit Application", () => {
  const profile = { fullName: "Jane Doe", phone: "", location: "", skills: "", summary: "", education: [], workHistory: [] } as never;
  const form = () => (
    <><CareersToaster /><ApplicationForm jobPostingId="p1" title="Barista" email="jane@example.com" profile={profile} requiredDocuments={["Resume"]} documents={[{ id: 7, name: "cv.pdf" }]} /></>
  );
  async function fill() {
    await userEvent.selectOptions(screen.getByLabelText(/Resume/), "7");
    await userEvent.click(screen.getByRole("checkbox"));
  }

  test("shows progress with the button disabled, then confirms", async () => {
    const gate = deferred<object>();
    submitApplicationAction.mockReturnValue(gate.promise);
    render(form());
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit Application" }));
    expect(await screen.findByRole("progressbar")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submitting…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => gate.resolve({ referenceNumber: "BR-1", sentAt: new Date().toISOString(), confirmationEmailSent: true }));
    expect(await screen.findByText("Application submitted")).toBeTruthy();
  });

  test("a failure shows the error with Retry and keeps what was chosen", async () => {
    submitApplicationAction.mockResolvedValueOnce({ message: "Posting closed." }).mockResolvedValueOnce({ referenceNumber: "BR-1", sentAt: new Date().toISOString(), confirmationEmailSent: true });
    render(form());
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Submit Application" }));
    expect((await screen.findAllByText("Posting closed.")).length).toBeGreaterThan(0);
    await waitFor(() => expect((screen.getByLabelText(/Resume/) as HTMLSelectElement).value).toBe("7"));
    expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Application submitted")).toBeTruthy();
    expect(submitApplicationAction).toHaveBeenCalledTimes(2);
  });
});
