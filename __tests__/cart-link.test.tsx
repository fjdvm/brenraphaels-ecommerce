// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { CartLink } from "@/components/shared/cart-link";
import { addVisitorCartLine, clearVisitorCart } from "@/lib/orders/visitor-cart";

const line = {
  sizeId: 1,
  productSlug: "ube-jam",
  productName: "Ube Jam",
  sizeLabel: "250g",
  priceInCentavos: 21900,
  quantity: 3,
};

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Cart link", () => {
  test("shows no badge for an empty Cart", () => {
    render(<CartLink customerCount={0} />);

    expect(screen.getByRole("link", { name: "Cart" }).textContent).toBe("");
  });

  test.each([
    [1, "Cart, 1 item", "1"],
    [4, "Cart, 4 items", "4"],
    [120, "Cart, 120 items", "99+"],
  ])("badges a Customer's %i units", (count, name, badge) => {
    render(<CartLink customerCount={count} />);

    const link = screen.getByRole("link", { name });
    expect(link.getAttribute("href")).toBe("/cart");
    expect(link.textContent).toBe(badge);
  });

  test("follows a Visitor's Cart as it is filled and emptied", () => {
    addVisitorCartLine(line);
    render(<CartLink />);
    expect(screen.getByRole("link").textContent).toBe("3");

    act(() => addVisitorCartLine({ ...line, sizeId: 2, quantity: 1 }));
    expect(screen.getByRole("link").textContent).toBe("4");

    act(() => clearVisitorCart());
    expect(screen.getByRole("link").textContent).toBe("");
  });
});
