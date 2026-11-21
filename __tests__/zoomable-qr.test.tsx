// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { CopyNumber } from "@/components/features/orders/copy-number";
import { ZoomableQr } from "@/components/features/orders/zoomable-qr";

afterEach(cleanup);

test("clicking the QR code opens it full-screen and Close brings the page back", () => {
  render(<ZoomableQr label="Main" src="https://files.test/qr.png?sig=1" />);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Enlarge QR for Main" }));
  expect(screen.getByRole("dialog", { name: "QR for Main" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("the QR is shown small with no Download button", () => {
  render(<ZoomableQr label="Main" src="https://files.test/qr.png?sig=1" />);
  expect(screen.queryByRole("button", { name: "Download QR" })).toBeNull();
  expect(screen.getByRole("img", { name: "QR for Main" }).className).toMatch(/size-32/);
});

test("the account number has a Copy button that puts it on the clipboard", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<CopyNumber value="09297787289" />);
  fireEvent.click(screen.getByRole("button", { name: "Copy account number 09297787289" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("09297787289"));
  expect((await screen.findByRole("status")).textContent).toBe("Copied");
});
