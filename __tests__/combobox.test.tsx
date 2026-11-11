// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";

import { Combobox } from "@/components/ui/combobox";

const options = [
  { value: "quezon-city", label: "Quezon City, Philippines" },
  { value: "remote", label: "Remote (Philippines)" },
  { value: "makati", label: "Makati" },
];

function renderCombobox(props: Partial<Parameters<typeof Combobox>[0]> = {}) {
  return render(
    <form aria-label="filters">
      <Combobox label="Location" name="location" options={options} {...props} />
    </form>,
  );
}

const submitted = () => new FormData(screen.getByRole("form", { name: "filters" }) as HTMLFormElement).get("location");

afterEach(cleanup);

describe("Combobox", () => {
  test("is labelled for screen readers and lists every option when opened", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole("combobox", { name: "Location" }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  test("filters the options as you type", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.type(screen.getByRole("combobox", { name: "Location" }), "phil");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Quezon City, Philippines",
      "Remote (Philippines)",
    ]);
  });

  test("selects with the mouse", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.click(screen.getByRole("combobox", { name: "Location" }));
    await user.click(screen.getByRole("option", { name: "Makati" }));
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveProperty("value", "Makati");
    expect(screen.queryByRole("option")).toBeNull();
    expect(submitted()).toBe("makati");
  });

  test("selects with the keyboard", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.type(screen.getByRole("combobox", { name: "Location" }), "{ArrowDown}{ArrowDown}{Enter}");
    expect(submitted()).toBe("remote");
  });

  test("closes on Escape without selecting", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.type(screen.getByRole("combobox", { name: "Location" }), "{ArrowDown}{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(submitted()).toBe("");
  });

  test("clears the selection", async () => {
    const user = userEvent.setup();
    renderCombobox({ defaultValue: "makati" });
    expect(submitted()).toBe("makati");
    await user.click(screen.getByRole("button", { name: "Clear Location" }));
    expect(screen.getByRole("combobox", { name: "Location" })).toHaveProperty("value", "");
    expect(submitted()).toBe("");
  });

  test("shows a message when nothing matches", async () => {
    const user = userEvent.setup();
    renderCombobox();
    await user.type(screen.getByRole("combobox", { name: "Location" }), "zzz");
    expect(screen.queryByRole("option")).toBeNull();
    expect(screen.getByText("No matches found")).toBeTruthy();
  });

  test("submits the value with the form, empty until something is chosen", async () => {
    const user = userEvent.setup();
    renderCombobox();
    expect(submitted()).toBe("");
    await user.click(screen.getByRole("combobox", { name: "Location" }));
    await user.click(screen.getByRole("option", { name: "Quezon City, Philippines" }));
    expect(submitted()).toBe("quezon-city");
  });

  test("typed text that is not chosen from the list is not submitted", async () => {
    const user = userEvent.setup();
    renderCombobox({ defaultValue: "makati" });
    await user.type(screen.getByRole("combobox", { name: "Location" }), "x");
    expect(submitted()).toBe("");
  });
});
