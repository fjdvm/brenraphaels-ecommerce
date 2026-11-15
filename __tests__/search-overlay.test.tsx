// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));

import { SearchOverlay, clearSearchCache } from "../components/features/catalog/search-overlay";

const results = [
  { slug: "smooth", name: "Ube Halaya Smooth", image: "/a.jpg", meta: "250g · 500g", price: "₱219 – ₱399", stock: { kind: "low", text: "Only 7 left" } },
  { slug: "classic", name: "Ube Halaya Classic", image: "/b.jpg", meta: "250g", price: "₱199", stock: { kind: "sold-out", text: "Sold out" } },
  { slug: "jam", name: "Ube Jam", image: "/c.jpg", meta: "250g", price: "₱219", stock: null },
];

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
  clearSearchCache();
});
afterEach(cleanup);

function open() {
  render(<SearchOverlay open onOpenChange={() => {}} />);
}

test("while the Products load, it shows a skeleton at once and then the results", async () => {
  let resolve!: (value: unknown) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => (resolve = r))));
  open();
  fireEvent.change(screen.getByLabelText("Search products by name"), { target: { value: "halaya" } });
  expect(document.querySelector("[data-slot=skeleton]")).toBeTruthy();
  resolve({ ok: true, json: async () => ({ results }) });
  await waitFor(() => expect(screen.getAllByText("Ube Halaya Smooth").length).toBeGreaterThan(0));
});

test("results show stock labels and keep sold out Products", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results }) })));
  open();
  fireEvent.change(screen.getByLabelText("Search products by name"), { target: { value: "halaya" } });
  await waitFor(() => expect(screen.getAllByText("Only 7 left").length).toBeGreaterThan(0));
  expect(screen.getAllByText("Sold out").length).toBeGreaterThan(0);
  expect(screen.queryByText("Ube Jam")).toBeNull();
  expect(screen.getByText(/See all 2 results for “halaya”/)).toBeTruthy();
});

test("submitting goes to the Shop search and remembers the term", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ results }) })));
  open();
  const input = screen.getByLabelText("Search products by name");
  fireEvent.change(input, { target: { value: "halaya" } });
  fireEvent.submit(input.closest("form")!);
  expect(push).toHaveBeenCalledWith("/products?q=halaya");
  expect(JSON.parse(localStorage.getItem("shop-recent-searches")!)).toEqual(["halaya"]);
});

test("a failed load says so and offers a retry", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false })));
  open();
  fireEvent.change(screen.getByLabelText("Search products by name"), { target: { value: "halaya" } });
  expect((await screen.findByRole("alert")).textContent).toContain("Search is unavailable");
  expect(screen.getByText("Try again")).toBeTruthy();
});
