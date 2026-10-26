// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const markRead = vi.fn();
const markAllRead = vi.fn();
vi.mock("@/app/(site)/(protected)/profile/notifications/actions", () => ({
  markNotificationRead: (id: string) => markRead(id),
  markAllNotificationsRead: () => markAllRead(),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, className }: { href: string; children: ReactNode; onClick?: () => void; className?: string }) => (
    <a className={className} href={href} onClick={(event) => { event.preventDefault(); onClick?.(); }}>{children}</a>
  ),
}));

import { NotificationsFeed } from "@/components/features/customer/notifications-feed";
import type { InboxNotification } from "@/lib/notifications/inbox";

const site = "https://shop.test";
const now = new Date("2026-10-26T06:30:00Z");
/** The "Unread" marker on each feed row; the filter chip of the same name is a button, not a marker. */
const unreadRows = () => document.querySelector("ul")!.querySelectorAll(".sr-only");
const notification = (overrides: Partial<InboxNotification>): InboxNotification => ({
  id: "n-1",
  type: "order.delivered",
  title: "Order #7 delivered",
  body: "Your Refund window is open for 24 hours.",
  link: "/profile/orders?order=7",
  createdAt: new Date("2026-10-26T06:00:00Z"),
  readAt: null,
  ...overrides,
});

beforeEach(() => vi.stubEnv("NEXT_PUBLIC_SITE_URL", site));

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
  markRead.mockClear();
  markAllRead.mockClear();
});

describe("Customer's Notifications page", () => {
  test("shows the empty page for a Customer with no stored Notifications", () => {
    render(<NotificationsFeed items={[]} now={now} />);

    expect(screen.getByRole("status").textContent).toContain("will appear here");
  });

  test("highlights unread rows and shows the stored title and text", () => {
    render(<NotificationsFeed items={[notification({}), notification({ id: "n-2", title: "Order #6 delivered", body: "Thanks!", readAt: new Date() })]} now={now} />);

    expect(screen.getByText("Your Refund window is open for 24 hours.")).toBeTruthy();
    expect(unreadRows()).toHaveLength(1);
  });

  test("clicking a row marks it read, un-highlights it and opens its link", () => {
    render(<NotificationsFeed items={[notification({})]} now={now} />);

    const row = screen.getByRole("link", { name: /Order #7 delivered/ });
    expect(row.getAttribute("href")).toBe("/profile/orders?order=7");
    fireEvent.click(row);

    expect(markRead).toHaveBeenCalledWith("n-1");
    expect(unreadRows()).toHaveLength(0);
  });

  test("clicking a row that is already read does not mark it again", () => {
    render(<NotificationsFeed items={[notification({ readAt: new Date() })]} now={now} />);

    fireEvent.click(screen.getByRole("link", { name: /Order #7 delivered/ }));

    expect(markRead).not.toHaveBeenCalled();
  });

  test("a row with no link is marked read on click", () => {
    render(<NotificationsFeed items={[notification({ link: null })]} now={now} />);

    fireEvent.click(screen.getByRole("button", { name: /Order #7 delivered/ }));

    expect(markRead).toHaveBeenCalledWith("n-1");
    expect(unreadRows()).toHaveLength(0);
  });

  test("Mark all as read clears every highlight", () => {
    render(<NotificationsFeed items={[notification({}), notification({ id: "n-2" })]} now={now} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(markAllRead).toHaveBeenCalledTimes(1);
    expect(unreadRows()).toHaveLength(0);
  });

  test("a Notification pushed in after the page loaded appears, still unread", () => {
    const { rerender } = render(<NotificationsFeed items={[notification({})]} now={now} />);
    fireEvent.click(screen.getByRole("link", { name: /Order #7 delivered/ }));

    rerender(<NotificationsFeed items={[notification({ id: "n-3", title: "Order #8 delivered" }), notification({})]} now={now} />);

    expect(screen.getByText("Order #8 delivered")).toBeTruthy();
    expect(unreadRows()).toHaveLength(1);
  });
});

/** One row per Notification kind the storefront stores, worded as its sender words it and linked by absolute address. */
const order = `${site}/profile/orders?order=7`;
const returnRow = (status: string, title: string, body: string) => ({ type: `return.${status}`, title, body, link: order, path: "/profile/orders?order=7", icon: "return" });
const kinds = [
  { type: "order.delivery-fee", title: "Delivery fee quoted for Order #7", body: "Your Delivery fee is ₱150.00. View your confirmed Order.", link: order, path: "/profile/orders?order=7", icon: "fee" },
  { type: "order.payment-needed", title: "Payment needed for Order #7", body: "Please submit your GCash Payment proof to continue your Order.", link: order, path: "/profile/orders?order=7", icon: "payment" },
  { type: "order.dispatched", title: "Order #7 dispatched", body: "Your Order has been dispatched. View your Order for details.", link: order, path: "/profile/orders?order=7", icon: "delivery" },
  { type: "order.delivered", title: "Your Order #7 was delivered", body: "Your Refund window is 24 hours from delivery to request a Return.", link: order, path: "/profile/orders?order=7", icon: "confirmed" },
  { type: "order.cancelled", title: "Order #7 cancelled", body: "Your Order has been cancelled. View your Order for details.", link: order, path: "/profile/orders?order=7", icon: "cancelled" },
  { type: "ticket.reply", title: "New reply on Ticket TKT-12", body: "Staff replied to your Ticket: Wrong size", link: `${site}/support/abc-123`, path: "/support/abc-123", icon: "support" },
  { type: "feedback.request", title: "How was Order #7?", body: "Tell us how your Order went.", link: `${site}/profile/orders/7/feedback`, path: "/profile/orders/7/feedback", icon: "feedback" },
];
const returns = [
  returnRow("requested", "Return RMA-4 requested", "We've received your Return request RMA-4."),
  returnRow("approved", "Return RMA-4 approved", "Your Return RMA-4 was approved as a refund."),
  returnRow("declined", "Return RMA-4 declined", "We couldn't approve your Return RMA-4."),
  returnRow("goods-received", "Return RMA-4: goods received", "We've received the goods for your Return RMA-4."),
  returnRow("refunded", "Return RMA-4 refunded", "Your Return RMA-4 has been refunded."),
  returnRow("replaced", "Return RMA-4 replaced", "We've sent a replacement for your Return RMA-4."),
];

describe("every Notification kind", () => {
  test.each([...kinds, ...returns])("$type shows its own title, text, look and link, and clicking marks it read", ({ type, title, body, link, path, icon }) => {
    render(<NotificationsFeed items={[notification({ id: `id-${type}`, type, title, body, link })]} now={now} />);

    const row = screen.getByRole("link", { name: new RegExp(title) });
    expect(row.textContent).toContain(body);
    expect(row.getAttribute("href")).toBe(path);
    expect(row.querySelector(`[data-icon="${icon}"]`)).not.toBeNull();
    fireEvent.click(row);

    expect(markRead).toHaveBeenCalledWith(`id-${type}`);
    expect(unreadRows()).toHaveLength(0);
  });

  test("each kind has a look of its own", () => {
    render(<NotificationsFeed items={kinds.map((kind) => notification({ ...kind, id: kind.type }))} now={now} />);

    const icons = [...document.querySelectorAll("[data-icon]")].map((node) => node.getAttribute("data-icon"));
    expect(new Set(icons).size).toBe(kinds.length);
  });
});
