"use client";

import { Check, MessageCircle, Package, Receipt, Star, Truck, Undo2, Wallet, XCircle } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

import { markAllNotificationsRead, markNotificationRead } from "@/app/(site)/(protected)/profile/notifications/actions";
import type { InboxNotification } from "@/lib/notifications/inbox";
import { categoryOf, iconOf, linkTarget, type NotificationIcon } from "@/lib/notifications/inbox-view";
import { relativeTime } from "@/lib/notifications/relative-time";
import { cn } from "@/lib/utils";

type Filter = "all" | "unread" | "orders" | "support";

const iconStyles: Record<NotificationIcon, { className: string; icon: ReactNode }> = {
  fee: { className: "bg-warning-soft text-warning", icon: <Receipt aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  payment: { className: "bg-warning-soft text-warning", icon: <Wallet aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  delivery: { className: "bg-surface-soft text-primary", icon: <Truck aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  confirmed: { className: "bg-success-soft text-success", icon: <Check aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  cancelled: { className: "bg-line text-muted", icon: <XCircle aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  support: { className: "bg-lavender text-primary", icon: <MessageCircle aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  return: { className: "bg-lavender text-primary", icon: <Undo2 aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  feedback: { className: "bg-success-soft text-success", icon: <Star aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
  order: { className: "bg-surface-soft text-primary", icon: <Package aria-hidden className="size-[18px]" strokeWidth={1.5} /> },
};

const preferenceRows = [
  { id: "orders", label: "Order status updates", initial: true },
  { id: "support", label: "Support replies", initial: true },
  { id: "email", label: "Email me a copy", initial: false },
];

/** The Notifications page body: the Customer's stored inbox, filterable, and the delivery preferences. */
export function NotificationsFeed({ items, now }: { items: InboxNotification[]; now: Date }) {
  const [filter, setFilter] = useState<Filter>("all");
  // Rows the Customer has just read here, shown as read before the stored inbox catches up.
  const [justRead, setJustRead] = useState<Set<string>>(new Set());
  const isUnread = (item: InboxNotification) => item.readAt === null && !justRead.has(item.id);
  const unread = items.filter(isUnread);
  const visible = items.filter((item) => {
    if (filter === "unread") return isUnread(item);
    if (filter === "all") return true;
    return categoryOf(item) === filter;
  });
  const chips: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: "All" },
    { id: "unread", label: "Unread", count: unread.length },
    { id: "orders", label: "Orders" },
    { id: "support", label: "Support" },
  ];

  /** Marks the row read before anything else, so a link that is slow or fails to open still leaves it read. */
  const read = (item: InboxNotification) => {
    if (!isUnread(item)) return;
    setJustRead((current) => new Set(current).add(item.id));
    void markNotificationRead(item.id);
  };
  const readAll = () => {
    setJustRead(new Set(items.map((item) => item.id)));
    void markAllNotificationsRead();
  };

  return (
    <div className="flex flex-col gap-[30px]">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-3">
        <div aria-label="Filter notifications" className="flex flex-wrap gap-2.5" role="group">
          {chips.map(({ id, label, count }) => {
            const active = filter === id;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-[18px] py-[9px] text-sm font-medium tracking-[0.45px] transition-colors",
                  active ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:bg-lavender-soft",
                )}
                key={id}
                onClick={() => setFilter(id)}
                type="button"
              >
                {label}
                {count ? <span className={cn("text-xs font-normal", active ? "text-accent" : "text-muted")}>{count}</span> : null}
              </button>
            );
          })}
        </div>
        <button
          className="ml-auto text-sm font-medium tracking-[0.35px] text-primary hover:underline disabled:opacity-50 disabled:hover:no-underline"
          disabled={unread.length === 0}
          onClick={readAll}
          type="button"
        >
          Mark all as read
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-[40px] border border-line bg-white p-10 text-body" role="status">
          {items.length === 0 ? "Updates about your orders and support conversations will appear here." : "Nothing to show in this view."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[40px] border border-line bg-white">
          {visible.map((item) => {
            const unreadRow = isUnread(item);
            const iconKind = iconOf(item);
            const style = iconStyles[iconKind];
            const rowClass = cn(
              "flex w-full gap-4 px-[26px] py-5 text-left",
              unreadRow && "bg-lavender-soft",
              (item.link || unreadRow) && "hover:bg-lavender-soft focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
            );
            const content = (
              <>
                <span aria-hidden data-icon={iconKind} className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", style.className)}>
                  {style.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-start gap-3">
                    <span className="flex-1 text-[13px] font-medium leading-[1.4] tracking-[0.35px] text-ink">{item.title}</span>
                    <span className="flex shrink-0 items-center gap-2 text-xs tracking-[0.35px] text-muted">
                      <time dateTime={item.createdAt.toISOString()}>{relativeTime(item.createdAt, now)}</time>
                      {unreadRow ? (
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
                ) : unreadRow ? (
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
      )}

      <Preferences />
    </div>
  );
}

function Preferences() {
  const [values, setValues] = useState(() => Object.fromEntries(preferenceRows.map((row) => [row.id, row.initial])));

  return (
    <section className="flex flex-col gap-5 rounded-[40px] border border-line bg-white p-6 sm:p-[34px]">
      <h2 className="font-serif text-2xl leading-[1.3] text-primary">Notification preferences</h2>
      <ul className="flex flex-col gap-4">
        {preferenceRows.map(({ id, label }) => (
          <li key={id}>
            <label className="flex cursor-pointer items-center justify-between gap-4 text-sm tracking-[0.35px] text-ink" htmlFor={`pref-${id}`}>
              {label}
              <input
                checked={values[id]}
                className="peer sr-only"
                id={`pref-${id}`}
                onChange={(event) => setValues((current) => ({ ...current, [id]: event.target.checked }))}
                role="switch"
                type="checkbox"
              />
              <span
                aria-hidden
                className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-[3px] after:top-[3px] after:size-[18px] after:rounded-full after:bg-white after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
              />
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
