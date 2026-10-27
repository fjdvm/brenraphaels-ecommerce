import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

vi.mock("@/app/(careers)/careers/(portal)/notifications/actions", () => ({
  markApplicantNotificationRead: vi.fn(),
  markAllApplicantNotificationsRead: vi.fn(),
}));

import { ApplicantNotificationsFeed } from "@/app/(careers)/careers/(portal)/notifications/applicant-notifications-feed";
import { NotificationBell } from "@/components/shared/notification-bell";

const now = new Date("2026-10-28T12:00:00Z");
const item = (id: string, over = {}) => ({
  id,
  type: "job-posting.opened",
  title: `New Job Posting ${id}`,
  body: "Applications are now open.",
  link: `https://example.com/careers/${id}`,
  createdAt: new Date("2026-10-28T11:00:00Z"),
  readAt: null,
  ...over,
});

it("lists notifications in the given order, each linking to its Job Posting", () => {
  const html = renderToStaticMarkup(<ApplicantNotificationsFeed items={[item("b"), item("a")]} now={now} />);
  expect(html.indexOf("New Job Posting b")).toBeLessThan(html.indexOf("New Job Posting a"));
  expect(html).toContain('href="https://example.com/careers/b"');
  expect(html).toContain("2 unread");
});

it("marks read rows as read and disables mark-all when nothing is unread", () => {
  const html = renderToStaticMarkup(<ApplicantNotificationsFeed items={[item("a", { readAt: new Date() })]} now={now} />);
  expect(html).toContain("all caught up");
  expect(html).not.toContain("Unread</span>");
  expect(html).toMatch(/<button[^>]*disabled[^>]*>Mark all as read/);
});

it("shows an empty state", () => {
  const html = renderToStaticMarkup(<ApplicantNotificationsFeed items={[]} now={now} />);
  expect(html).toContain("No notifications yet");
});

it("badges the bell with the unread count and links to the inbox", () => {
  const html = renderToStaticMarkup(<NotificationBell href="/careers/notifications" unread={3} />);
  expect(html).toContain('href="/careers/notifications"');
  expect(html).toContain('aria-label="Notifications, 3 unread"');
});
