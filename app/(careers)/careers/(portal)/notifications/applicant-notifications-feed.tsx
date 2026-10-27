"use client";

import { Briefcase, Bell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { InboxNotification } from "@/lib/notifications/gateway-inbox";
import { linkTarget } from "@/lib/notifications/inbox-view";
import { relativeTime } from "@/lib/notifications/relative-time";
import { cn } from "@/lib/utils";

import { markAllApplicantNotificationsRead, markApplicantNotificationRead } from "./actions";

/** The Applicant's stored inbox, newest first as the service returns it, with mark-read and mark-all-read. */
export function ApplicantNotificationsFeed({ items, now }: { items: InboxNotification[]; now: Date }) {
  // Rows the Applicant has just read here, shown as read before the stored inbox catches up.
  const [justRead, setJustRead] = useState<Set<string>>(new Set());
  const isUnread = (item: InboxNotification) => item.readAt === null && !justRead.has(item.id);
  const unreadCount = items.filter(isUnread).length;

  /** Marks the row read before anything else, so a link that is slow or fails to open still leaves it read. */
  const read = (item: InboxNotification) => {
    if (!isUnread(item)) return;
    setJustRead((current) => new Set(current).add(item.id));
    void markApplicantNotificationRead(item.id);
  };
  const readAll = () => {
    setJustRead(new Set(items.map((item) => item.id)));
    void markAllApplicantNotificationsRead();
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-5 rounded-[40px] border border-line bg-white px-6 py-16 text-center sm:p-20" role="status">
        <span aria-hidden className="flex size-24 items-center justify-center rounded-full bg-lavender text-primary">
          <Bell className="size-[43px]" strokeWidth={1.25} />
        </span>
        <h2 className="font-serif text-3xl leading-[1.2] text-primary sm:text-[40px]">No notifications yet</h2>
        <p className="max-w-[460px] leading-[1.6] tracking-[0.35px] text-body">
          When a new Job Posting opens, you&apos;ll see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <p aria-live="polite" className="text-sm tracking-[0.35px] text-body">
          {unreadCount === 0 ? "You're all caught up." : `${unreadCount} unread`}
        </p>
        <button
          className="text-sm font-medium tracking-[0.35px] text-primary hover:underline disabled:opacity-50 disabled:hover:no-underline"
          disabled={unreadCount === 0}
          onClick={readAll}
          type="button"
        >
          Mark all as read
        </button>
      </div>
      <ul className="overflow-hidden rounded-[40px] border border-line bg-white">
        {items.map((item) => {
          const unread = isUnread(item);
          const rowClass = cn(
            "flex w-full gap-4 px-5 py-5 text-left sm:px-[26px]",
            unread && "bg-lavender-soft",
            (item.link || unread) && "hover:bg-lavender-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          );
          const content = (
            <>
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lavender text-primary">
                <Briefcase className="size-[18px]" strokeWidth={1.5} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="flex flex-wrap items-start gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-[1.4] tracking-[0.35px] text-ink">{item.title}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs tracking-[0.35px] text-muted">
                    <time dateTime={item.createdAt.toISOString()}>{relativeTime(item.createdAt, now)}</time>
                    {unread ? (
                      <>
                        <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                        <span className="sr-only">Unread</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="text-[13px] leading-[1.5] tracking-[0.35px] text-body">{item.body}</span>
              </span>
            </>
          );
          return (
            <li className="border-b border-line last:border-b-0" key={item.id}>
              {item.link ? (
                <Link className={rowClass} href={linkTarget(item.link, process.env.NEXT_PUBLIC_SITE_URL)} onClick={() => read(item)}>
                  {content}
                </Link>
              ) : unread ? (
                <button className={rowClass} onClick={() => read(item)} type="button">
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
