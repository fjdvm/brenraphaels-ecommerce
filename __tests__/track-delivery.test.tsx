// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { TrackDelivery } from "@/components/features/orders/track-delivery";

const courier = { name: "Lalamove" as const, trackingUrl: "https://share.lalamove.com/x" };
afterEach(cleanup);

describe("Track your delivery", () => {
  test("Track Order opens the live map in the Delivery tab, the courier's page is a second link, and no rider details show", () => {
    render(<TrackDelivery orderId={7} courier={{ ...courier, riderName: "Jomar Pascual" } as never} />);
    expect(screen.getByRole("link", { name: "Track Order" }).getAttribute("href")).toBe("/profile/delivery/7");
    const external = screen.getByRole("link", { name: "Open in Lalamove" });
    expect(external.getAttribute("href")).toBe(courier.trackingUrl);
    expect(external.getAttribute("target")).toBe("_blank");
    expect(screen.queryByText("Jomar Pascual")).toBeNull();
    expect(screen.queryByText("Rider")).toBeNull();
  });

  test("shows the courier but no button when there is no link", () => {
    render(<TrackDelivery orderId={7} courier={{ name: "Grab", trackingUrl: null }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Grab")).toBeTruthy();
    expect(screen.getByText("A tracking link is not available yet.")).toBeTruthy();
  });
});
