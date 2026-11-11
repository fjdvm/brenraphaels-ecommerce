// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { HeroImages } from "../components/features/careers/hero-images";

afterEach(cleanup);

describe("Hero images", () => {
  test("each landing photo opens the viewer on that photo", async () => {
    const user = userEvent.setup();
    render(<HeroImages />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "View photo: Ube powder in a wooden spoon" }));
    expect(screen.getByRole("dialog", { name: "Life at Bren Raphael's photos" })).toBeTruthy();
    expect(screen.getAllByText(/4 \/ 4/).length).toBeGreaterThan(0);

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
