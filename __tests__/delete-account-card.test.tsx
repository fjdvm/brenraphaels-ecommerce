// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";

const requestAccountDeletion = vi.hoisted(() => vi.fn());
vi.mock("@/app/(site)/(protected)/profile/delete-account-actions", () => ({ requestAccountDeletion }));

import { DeleteAccountCard } from "@/components/features/customer/delete-account-card";

afterEach(() => { cleanup(); requestAccountDeletion.mockReset(); });

test("the confirm dialog comes first: nothing is sent until the Customer confirms", async () => {
  render(<DeleteAccountCard />);
  await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  expect(screen.getByText("Delete your account?")).toBeTruthy();
  expect(requestAccountDeletion).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Keep my account" }));
  expect(requestAccountDeletion).not.toHaveBeenCalled();
});

test("confirming shows the spinner at once and waits for the server", async () => {
  requestAccountDeletion.mockReturnValue(new Promise(() => {}));
  render(<DeleteAccountCard />);
  await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Delete my account" }).at(-1)!);
  expect((await screen.findByRole("button", { name: "Deleting…" })).getAttribute("aria-busy")).toBe("true");
  expect(requestAccountDeletion).toHaveBeenCalledTimes(1);
});

test("a refusal lists every blocker and disables deleting", async () => {
  requestAccountDeletion.mockResolvedValue({
    blockers: [{ kind: "order", id: 12, status: "paid" }, { kind: "ticket", id: 3, status: "on_hold" }],
  });
  render(<DeleteAccountCard />);
  await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Delete my account" }).at(-1)!);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Order #12 (paid)");
  expect(alert.textContent).toContain("Ticket #3 (on hold)");
  expect(((await screen.findByRole("button", { name: "Delete my account" })) as HTMLButtonElement).disabled).toBe(true);
});

test("a server failure is said in plain words and deleting can be retried", async () => {
  requestAccountDeletion.mockResolvedValue({ error: "We couldn't delete your account. Please try again." });
  render(<DeleteAccountCard />);
  await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Delete my account" }).at(-1)!);
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't delete your account");
  await waitFor(() => expect((screen.getByRole("button", { name: "Delete my account" }) as HTMLButtonElement).disabled).toBe(false));
});

test("a thrown error also shows a message", async () => {
  requestAccountDeletion.mockRejectedValue(new Error("network"));
  render(<DeleteAccountCard />);
  await userEvent.click(screen.getByRole("button", { name: "Delete my account" }));
  await userEvent.click(screen.getAllByRole("button", { name: "Delete my account" }).at(-1)!);
  expect((await screen.findByRole("alert")).textContent).toContain("couldn't delete your account");
});
