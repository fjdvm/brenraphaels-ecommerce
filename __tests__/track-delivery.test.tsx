// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { TrackDelivery } from "@/components/features/orders/track-delivery";

const courier = { name: "Lalamove" as const, trackingUrl: "https://share.lalamove.com/x", riderName: "Jomar Pascual", riderPlate: "NCB 4412", riderPhone: "0917 552 1180" };
afterEach(cleanup);

describe("Track your delivery", () => {
  test("links to the booking and shows rider details while dispatched", () => {
    render(<TrackDelivery courier={courier} status="dispatched" />);
    expect(screen.getByRole("link", { name: /Track your delivery/ }).getAttribute("href")).toBe(courier.trackingUrl);
    for (const text of ["Jomar Pascual", "NCB 4412", "0917 552 1180"]) expect(screen.getByText(text)).toBeTruthy();
  });

  test("keeps rider details but drops the link after delivery", () => {
    render(<TrackDelivery courier={courier} status="delivered" />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Jomar Pascual")).toBeTruthy();
  });

  test("omits rider fields Staff left blank", () => {
    render(<TrackDelivery courier={{ ...courier, riderName: null, riderPlate: null, riderPhone: null }} status="dispatched" />);
    expect(screen.queryByText("Rider")).toBeNull();
  });
});
