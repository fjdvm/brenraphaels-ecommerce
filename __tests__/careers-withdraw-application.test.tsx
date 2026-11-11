// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@/app/(careers)/careers/(portal)/applications/actions", () => ({ withdrawApplicationAction: vi.fn() }));

import { WithdrawApplication } from "../app/(careers)/careers/_components/withdraw-application";

afterEach(cleanup);

describe("Withdraw application", () => {
  test("asks for confirmation before offering the final Withdraw", async () => {
    render(<WithdrawApplication referenceNumber="BR-APP-0412" />);
    expect(screen.queryByText("Withdraw this application?")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Withdraw application" }));
    expect(screen.getByText("Withdraw this application?")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Withdraw application" }).length).toBeGreaterThan(0);
  });
});
