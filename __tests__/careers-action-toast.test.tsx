// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CareersToaster, runWithToast } from "@/app/(careers)/careers/_components/action-toast";

afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  cleanup();
  vi.useRealTimers();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("action toast card", () => {
  test("shows an indeterminate bar while running, then turns into the success result", async () => {
    render(<CareersToaster />);
    const gate = deferred<{ ok: true }>();
    let done!: Promise<unknown>;
    act(() => {
      done = runWithToast({ loading: "Saving…", success: "Profile saved", task: () => gate.promise });
    });
    expect(await screen.findByText("Saving…")).toBeTruthy();
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBeNull();
    await act(async () => {
      gate.resolve({ ok: true });
      await done;
    });
    expect(await screen.findByText("Profile saved")).toBeTruthy();
    expect(screen.queryByText("Saving…")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  test("an error stays with Retry until dismissed, and Retry runs the task again", async () => {
    render(<CareersToaster />);
    const task = vi.fn().mockResolvedValueOnce({ ok: false, message: "We couldn't save." }).mockResolvedValueOnce({ ok: true });
    await act(async () => {
      await runWithToast({ loading: "Saving…", success: "Profile saved", task });
    });
    expect(await screen.findByText("We couldn't save.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Profile saved")).toBeTruthy();
    expect(task).toHaveBeenCalledTimes(2);
  });

  test("a thrown task shows the fallback error with Retry", async () => {
    render(<CareersToaster />);
    await act(async () => {
      await runWithToast({ loading: "Saving…", success: "ok", error: "Try again later.", task: () => Promise.reject(new Error("boom")) });
    });
    expect(await screen.findByText("Try again later.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByText("Try again later.")).toBeNull());
  });

  test("concurrent actions stack without hiding each other", async () => {
    render(<CareersToaster />);
    const a = deferred<{ ok: true }>();
    const b = deferred<{ ok: true }>();
    act(() => {
      void runWithToast({ loading: "Saving…", success: "Profile saved", task: () => a.promise });
      void runWithToast({ loading: "Deleting…", success: "Deleted", task: () => b.promise });
    });
    expect(await screen.findByText("Saving…")).toBeTruthy();
    expect(await screen.findByText("Deleting…")).toBeTruthy();
    await act(async () => {
      a.resolve({ ok: true });
    });
    expect(await screen.findByText("Profile saved")).toBeTruthy();
    expect(screen.getByText("Deleting…")).toBeTruthy();
  });

  test("a success dismisses itself after a few seconds", async () => {
    render(<CareersToaster />);
    await act(async () => {
      await runWithToast({ loading: "Saving…", success: "Profile saved", task: async () => ({ ok: true }) });
    });
    expect(await screen.findByText("Profile saved")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Profile saved")).toBeNull(), { timeout: 6500 });
  }, 10000);
});
