// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
afterEach(cleanup);

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span>{props.alt}</span> }));
vi.mock("@/lib/orders/add-product-size", () => ({ addProductSizeToCart: vi.fn() }));

import { ProductCard } from "../components/features/catalog/product-card";
import { AddToCart } from "../components/features/orders/add-to-cart";

const sizes = [
  { id: 1, label: "250g", priceInCentavos: 10000, available: true, left: 7 },
  { id: 2, label: "500g", priceInCentavos: 20000, available: false, left: 0 },
];

test("the shop card says how many are left of the tightest Size", () => {
  render(<ProductCard product={{ slug: "ube", name: "Ube", image: "/x.jpg", lowestPriceInCentavos: 10000, highestPriceInCentavos: 10000, sizes: [sizes[0]] }} customerHasCart={false} />);
  expect(screen.getByText("Only 7 left")).toBeTruthy();
});

test("the product page shows a low count and never a sold-out Size", () => {
  render(<AddToCart product={{ slug: "ube", name: "Ube", sizes }} customerHasCart={false} />);
  expect(screen.getByText("Only 7 left")).toBeTruthy();
  expect(screen.queryByText("500g")).toBeNull();
  expect(screen.queryByText(/Sold out/)).toBeNull();
});
