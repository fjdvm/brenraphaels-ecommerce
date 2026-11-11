// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { FilterForm } from "@/app/(careers)/careers/_components/filter-form";

const groups = [
  { name: "department" as const, label: "Department", allLabel: "All", options: ["Kitchen", "Retail"] },
  { name: "employmentType" as const, label: "Employment type", allLabel: "All", options: ["Full-time"] },
  { name: "location" as const, label: "Location", allLabel: "All locations", options: ["Makati", "Quezon City"] },
];
const postings = [
  { department: "Kitchen", employmentType: "Full-time", location: "Quezon City" },
  { department: "Kitchen", employmentType: "Full-time", location: "Makati" },
  { department: "Retail", employmentType: "Full-time", location: "Makati" },
];

afterEach(() => {
  cleanup();
  push.mockReset();
});

describe("Mobile filters sheet", () => {
  test("counts the matching roles as choices change and applies them", async () => {
    const user = userEvent.setup();
    render(<FilterForm groups={groups} selected={{}} postings={postings}><span /></FilterForm>);
    await user.click(screen.getByRole("button", { name: /Department/ }));
    expect(screen.getByRole("button", { name: "Show 3 roles" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "Kitchen" }));
    await user.click(screen.getByRole("radio", { name: "Quezon City" }));
    await user.click(screen.getByRole("button", { name: "Show 1 role" }));
    expect(push).toHaveBeenCalledWith("/careers?department=Kitchen&location=Quezon+City");
  });

  test("Clear resets every choice", async () => {
    const user = userEvent.setup();
    render(<FilterForm groups={groups} selected={{ department: "Retail" }} postings={postings}><span /></FilterForm>);
    await user.click(screen.getByRole("button", { name: /Retail/ }));
    expect(screen.getByRole("button", { name: "Show 1 role" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Show 3 roles" }));
    expect(push).toHaveBeenCalledWith("/careers");
  });
});
