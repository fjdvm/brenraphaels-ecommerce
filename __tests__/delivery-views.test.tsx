// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test } from "vitest";

import { DeliveriesSkeleton, DeliveryMapSkeleton } from "@/components/features/customer/skeletons";
import { DeliveryList } from "@/components/features/orders/delivery-list";
import { DeliveryMap } from "@/components/features/orders/delivery-map";
import DeliveryLoading from "@/app/(site)/(protected)/profile/delivery/loading";
import TrackOrderLoading from "@/app/(site)/(protected)/profile/delivery/[id]/loading";
import type { Delivery } from "@/lib/orders/deliveries";

afterEach(cleanup);

const delivery = (overrides: Partial<Delivery> = {}): Delivery => ({
  id: 38, status: "dispatched", courier: "Lalamove", trackingUrl: "https://share.lalamove.com/?PH123", deliveredAt: null,
  summary: "120 Mesh Ube Powder · 100g × 1", ...overrides,
});

describe("the Delivery list", () => {
  test("a card on the way has Track Order to its map; a delivered or received card has Go to order instead", () => {
    render(<DeliveryList deliveries={[
      delivery(),
      delivery({ id: 39, status: "delivered", deliveredAt: new Date("2026-11-20T06:00:00Z") }),
      delivery({ id: 40, status: "received", courier: "Grab" }),
    ]} />);
    const onTheWay = screen.getByRole("article", { name: "Order #38" });
    expect(within(onTheWay).getByText("Out for delivery")).toBeTruthy();
    expect(within(onTheWay).getByRole("link", { name: "Track Order" }).getAttribute("href")).toBe("/profile/delivery/38");
    expect(within(onTheWay).queryByRole("link", { name: /Go to order/ })).toBeNull();
    expect(within(onTheWay).getByText("120 Mesh Ube Powder · 100g × 1")).toBeTruthy();

    const delivered = screen.getByRole("article", { name: "Order #39" });
    expect(within(delivered).getByRole("link", { name: /Go to order/ }).getAttribute("href")).toBe("/profile/orders?order=39");
    expect(within(delivered).queryByRole("link", { name: "Track Order" })).toBeNull();
    expect(within(delivered).getByText(/^Delivered Nov 20, 2026/)).toBeTruthy();

    const received = screen.getByRole("article", { name: "Order #40" });
    expect(within(received).getByText("Received")).toBeTruthy();
    expect(within(received).getByRole("link", { name: /Go to order/ }).getAttribute("href")).toBe("/profile/orders?order=40");
  });
});

describe("the Track Order map", () => {
  test("shows only the courier's live map from the share link, with Back to the list and the courier's page as a fallback", () => {
    render(<DeliveryMap delivery={delivery()} />);
    const map = screen.getByTitle("Live delivery map for Order #38") as HTMLIFrameElement;
    expect(map.getAttribute("src")).toBe("https://share.lalamove.com/?PH123");
    expect(map.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin allow-popups");
    expect(map.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(screen.getByRole("link", { name: "Back to deliveries" }).getAttribute("href")).toBe("/profile/delivery");
    expect(screen.getByRole("link", { name: "Open in Lalamove" }).getAttribute("target")).toBe("_blank");
    expect(screen.queryByRole("link", { name: /Go to order/ })).toBeNull();
  });

  test("once delivered, it says so and offers Go to order", () => {
    render(<DeliveryMap delivery={delivery({ status: "delivered" })} />);
    expect(screen.getByRole("link", { name: /Go to order/ }).getAttribute("href")).toBe("/profile/orders?order=38");
    expect(screen.getByRole("status").textContent).toContain("has been delivered");
  });

  test("a link that is not the courier's own site is never embedded, only opened in a new tab", () => {
    render(<DeliveryMap delivery={delivery({ trackingUrl: "https://tracker.example.com/x" })} />);
    expect(screen.queryByTitle(/Live delivery map/)).toBeNull();
    expect(screen.getByRole("link", { name: "Open in Lalamove" }).getAttribute("href")).toBe("https://tracker.example.com/x");
  });
});

describe("instant navigation", () => {
  test("both Delivery pages show their heading and skeleton at once while data loads", () => {
    const list = renderToStaticMarkup(<DeliveryLoading />);
    expect(list).toContain(">Delivery<");
    expect(list).toContain(renderToStaticMarkup(<DeliveriesSkeleton />));
    const map = renderToStaticMarkup(<TrackOrderLoading />);
    expect(map).toContain(">Track Order<");
    expect(map).toContain(renderToStaticMarkup(<DeliveryMapSkeleton />));
  });
});
