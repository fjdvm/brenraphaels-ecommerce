// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { KindWords } from "@/components/features/home/kind-words";

const messages = [
  { src: "/a.jpg", place: "Chat A", quote: "First quote", alt: "Screenshot A" },
  { src: "/b.jpg", place: "Chat B", quote: "Second quote", alt: "Screenshot B" },
  { src: "/c.jpg", place: "Chat C", quote: "Third quote", alt: "Screenshot C" },
];

afterEach(cleanup);

describe("Kind words", () => {
  test("starts on the first review with a zero-padded counter", () => {
    render(<KindWords messages={messages} />);
    expect(screen.getByText(/First quote/)).toBeTruthy();
    expect(screen.getByText("01 / 03")).toBeTruthy();
    expect(screen.getByText("Chat A")).toBeTruthy();
  });

  test("Next and Previous step through the reviews and wrap around", async () => {
    const user = userEvent.setup();
    render(<KindWords messages={messages} />);
    const next = screen.getByRole("button", { name: "Next" });
    const previous = screen.getByRole("button", { name: "Previous" });

    await user.click(next);
    expect(screen.getByText("02 / 03")).toBeTruthy();
    await user.click(next);
    await user.click(next);
    expect(screen.getByText("01 / 03")).toBeTruthy();
    expect(screen.getByText(/First quote/)).toBeTruthy();

    await user.click(previous);
    expect(screen.getByText("03 / 03")).toBeTruthy();
    expect(screen.getByText(/Third quote/)).toBeTruthy();
  });

  test("the screenshot follows the review", async () => {
    const user = userEvent.setup();
    render(<KindWords messages={messages} />);
    expect(screen.getByAltText("Screenshot A")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByAltText("Screenshot B")).toBeTruthy();
  });

  test("announces the quote and counter politely when the review changes", async () => {
    const user = userEvent.setup();
    const { container } = render(<KindWords messages={messages} />);
    const live = container.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(live).toBeTruthy();
    expect(within(live).getByText(/First quote/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(within(live).getByText(/Second quote/)).toBeTruthy();
    expect(within(live).queryByText(/First quote/)).toBeNull();
  });

  test("containers are square", () => {
    const { container } = render(<KindWords messages={messages} />);
    expect(container.innerHTML).not.toMatch(/rounded-\[/);
  });
});
