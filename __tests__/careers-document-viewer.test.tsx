// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const open = vi.hoisted(() => vi.fn());
vi.mock("@/app/(careers)/careers/(portal)/profile/actions", () => ({ openApplicantDocumentLink: open }));
import { DocumentList } from "@/app/(careers)/careers/_components/document-list";

const documents = [
  { id: 1, name: "photo.png", contentType: "image/png", size: 2048 },
  { id: 2, name: "resume.pdf", contentType: "application/pdf", size: 4096 },
  { id: 3, name: "old-resume.doc", contentType: "application/msword", size: 3 * 1024 * 1024 },
];
beforeEach(() => open.mockImplementation(async (id: number) => ({ url: `https://files.test/${id}?signed` })));
afterEach(() => { cleanup(); open.mockReset(); });

test("an image opens inline in the viewer", async () => {
  render(<DocumentList documents={documents} />);
  await userEvent.click(screen.getByRole("button", { name: "Open photo.png" }));
  expect((await screen.findByRole("img", { name: "photo.png" })).getAttribute("src")).toBe("https://files.test/1?signed");
  expect(open).toHaveBeenCalledWith(1);
});

test("a PDF renders in a frame", async () => {
  render(<DocumentList documents={documents} />);
  await userEvent.click(screen.getByRole("button", { name: "Open resume.pdf" }));
  await waitFor(() => expect(screen.getByTitle("resume.pdf").getAttribute("src")).toBe("https://files.test/2?signed"));
});

test("a legacy Word file shows a card with name, size and Download", async () => {
  render(<DocumentList documents={documents} />);
  await userEvent.click(screen.getByRole("button", { name: "Open old-resume.doc" }));
  const link = await screen.findByRole("link", { name: /Download/ });
  expect(link.getAttribute("href")).toBe("https://files.test/3?signed");
  expect(screen.getAllByText("Word · 3.0 MB").length).toBe(2);
});

test("Next and Previous move across the Documents", async () => {
  const user = userEvent.setup();
  render(<DocumentList documents={documents} />);
  await user.click(screen.getByRole("button", { name: "Open photo.png" }));
  await screen.findByRole("img", { name: "photo.png" });
  await user.click(screen.getByRole("button", { name: "Next Document" }));
  await screen.findByTitle("resume.pdf");
  await user.click(screen.getByRole("button", { name: "Previous Document" }));
  await screen.findByRole("img", { name: "photo.png" });
});

test("a gateway failure shows a clear message and Retry fetches a new link", async () => {
  const user = userEvent.setup();
  open.mockResolvedValueOnce({ message: "We couldn't open that Document. Try again." });
  render(<DocumentList documents={documents} />);
  await user.click(screen.getByRole("button", { name: "Open photo.png" }));
  expect((await screen.findByRole("alert")).textContent).toContain("We couldn't open that Document. Try again.");
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByRole("img", { name: "photo.png" })).toBeTruthy();
  expect(open.mock.calls.filter((call) => call.length)).toEqual([[1], [1]]);
});

test("an expired link that no longer loads offers Retry with a fresh link", async () => {
  const user = userEvent.setup();
  render(<DocumentList documents={documents} />);
  await user.click(screen.getByRole("button", { name: "Open photo.png" }));
  const image = await screen.findByRole("img", { name: "photo.png" });
  image.dispatchEvent(new Event("error"));
  await user.click(await screen.findByRole("button", { name: "Retry" }));
  await screen.findByRole("img", { name: "photo.png" });
  expect(open.mock.calls.filter((call) => call.length)).toEqual([[1], [1]]);
});

test("closing and reopening asks for a new link", async () => {
  const user = userEvent.setup();
  render(<DocumentList documents={documents} />);
  await user.click(screen.getByRole("button", { name: "Open photo.png" }));
  await screen.findByRole("img", { name: "photo.png" });
  await user.click(screen.getByRole("button", { name: "Close" }));
  await user.click(screen.getByRole("button", { name: "Open photo.png" }));
  await screen.findByRole("img", { name: "photo.png" });
  expect(open.mock.calls.filter((call) => call.length)).toEqual([[1], [1]]);
});
