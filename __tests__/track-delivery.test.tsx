// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { TrackDelivery } from "@/components/features/orders/track-delivery";

const courier = { name: "Lalamove" as const, trackingUrl: "https://share.lalamove.com/x" };
afterEach(cleanup);

describe("Track your delivery", () => {
  test("links to the booking while dispatched, and shows no rider details", () => {
    render(<TrackDelivery courier={{ ...courier, riderName: "Jomar Pascual" } as never} />);
    expect(screen.getByRole("link", { name: /Track your delivery/ }).getAttribute("href")).toBe(courier.trackingUrl);
    expect(screen.queryByText("Jomar Pascual")).toBeNull();
    expect(screen.queryByText("Rider")).toBeNull();
  });

  test("shows the courier but no button when there is no link", () => {
    render(<TrackDelivery courier={{ name: "Grab", trackingUrl: null }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Grab")).toBeTruthy();
  });
});
