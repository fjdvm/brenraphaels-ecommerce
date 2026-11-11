// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ShareRoleButton } from "../app/(careers)/careers/_components/share-role-button";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Share role", () => {
  test("opens the device share sheet when there is one", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<ShareRoleButton title="Cook" />);
    await userEvent.click(screen.getByRole("button", { name: "Share role" }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ title: "Cook", url: window.location.href }));
  });

  test("copies the link and confirms when there is no share sheet", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<ShareRoleButton title="Cook" />);
    await userEvent.click(screen.getByRole("button", { name: "Share role" }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copied"));
  });
});
