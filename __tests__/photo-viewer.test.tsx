// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test } from "vitest";

import { PhotoViewer, type PhotoViewerItem } from "@/components/ui/photo-viewer";

const items: PhotoViewerItem[] = [
  { src: "/a.jpg", alt: "Team photo", caption: "Team in purple shirts", width: 1290, height: 714 },
  { src: "/b.jpg", alt: "Shelf photo", caption: "Products on the shelf", width: 1600, height: 1067 },
  { src: "/c.jpg", alt: "Jam photo", caption: "Jam and powder", width: 1200, height: 1800 },
];

function Harness() {
  const [index, setIndex] = useState<number | null>(null);
  return (
    <>
      <button onClick={() => setIndex(0)}>Open first</button>
      <button onClick={() => setIndex(1)}>Open second</button>
      <PhotoViewer label="Life at Bren Raphael's photos" items={items} index={index} onIndexChange={setIndex} />
    </>
  );
}

const position = (text: string) =>
  screen.getByText((_, el) => el?.tagName === "P" && el.getAttribute("aria-live") === "polite" && el.textContent === text);
const dialog = () => screen.getByRole("dialog", { name: "Life at Bren Raphael's photos" });
afterEach(cleanup);

describe("PhotoViewer", () => {
  test("renders nothing while closed", () => {
    render(<Harness />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("opens on the chosen photo with a position and caption, at its natural size", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open second"));
    expect(position("2 / 3 · Products on the shelf")).toBeTruthy();
    const photo = within(dialog()).getByAltText("Shelf photo");
    expect(photo.getAttribute("width")).toBe("1600");
    expect(photo.getAttribute("height")).toBe("1067");
    expect(photo.parentElement?.className).not.toMatch(/\bbg-/);
  });

  test("previous and next buttons move, and stop at the ends", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open first"));
    expect(screen.queryByRole("button", { name: "Previous photo" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(position("2 / 3 · Products on the shelf")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Next photo" }));
    expect(screen.queryByRole("button", { name: "Next photo" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Previous photo" }));
    expect(position("2 / 3 · Products on the shelf")).toBeTruthy();
  });

  test("arrow keys move", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open first"));
    await user.keyboard("{ArrowRight}");
    expect(position("2 / 3 · Products on the shelf")).toBeTruthy();
    await user.keyboard("{ArrowLeft}");
    expect(position("1 / 3 · Team in purple shirts")).toBeTruthy();
  });

  test("thumbnails jump to a photo and mark the current one", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open first"));
    const thumbs = within(dialog()).getAllByRole("button", { name: /^Show photo \d/ });
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].getAttribute("aria-current")).toBe("true");
    await user.click(thumbs[2]);
    expect(position("3 / 3 · Jam and powder")).toBeTruthy();
    expect(within(dialog()).getAllByRole("button", { name: /^Show photo \d/ })[2].getAttribute("aria-current")).toBe("true");
  });

  test("Escape, the close button and clicking outside the photo close it, and focus returns to the opener", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByText("Open second");

    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));

    await user.click(opener);
    await user.click(screen.getByTestId("photo-viewer-stage"));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  test("clicking the photo itself does not close it", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open first"));
    await user.click(screen.getByAltText("Team photo"));
    expect(dialog()).toBeTruthy();
  });

  test("traps focus inside the dialog", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText("Open first"));
    for (let i = 0; i < 12; i++) {
      await user.tab();
      expect(dialog().contains(document.activeElement)).toBe(true);
    }
  });
});
