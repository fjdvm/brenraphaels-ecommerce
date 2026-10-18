"use client";

import { Check, MessageCircle, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { relativeTime } from "@/lib/notifications/relative-time";
import { categoryLabel, filterTickets, ticketPreview, type InboxTicket, type TicketTab } from "@/lib/support/inbox";
import { cn } from "@/lib/utils";

/** The left column of Support: search, Open/Resolved tabs and the Customer's Tickets. */
export function SupportInbox({ tickets, now }: { tickets: InboxTicket[]; now: Date }) {
  const pathname = usePathname();
  const [tab, setTab] = useState<TicketTab>("open");
  const [query, setQuery] = useState("");
  const counts = {
    open: tickets.filter((ticket) => ticket.status === "open").length,
    resolved: tickets.filter((ticket) => ticket.status !== "open").length,
  };
  const visible = filterTickets(tickets, tab, query);
  const drafting = pathname === "/support/new";

  return (
    // On phones the list gives way to the open conversation or form.
    <div className={cn("flex-col border-line lg:flex lg:border-r", pathname === "/support" ? "flex" : "hidden")}>
      <div className="flex flex-col gap-4 p-6">
        <label className="relative block">
          <span className="sr-only">Search tickets</span>
          <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.5} />
          <input
            className="h-11 w-full rounded-full bg-surface-soft pl-11 pr-4 text-sm tracking-[0.35px] text-ink outline-none placeholder:text-muted focus:ring-2 focus:ring-ring"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tickets"
            type="search"
            value={query}
          />
        </label>
        <div aria-label="Ticket status" className="flex gap-2" role="group">
          {(["open", "resolved"] as const).map((id) => {
            const active = tab === id;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-[18px] py-[9px] text-sm font-medium capitalize tracking-[0.45px] transition-colors",
                  active ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:bg-lavender-soft",
                )}
                key={id}
                onClick={() => setTab(id)}
                type="button"
              >
                {id}
                <span className={cn("text-xs font-normal", active ? "text-accent" : "text-muted")}>{counts[id]}</span>
              </button>
            );
          })}
        </div>
      </div>
      <ul aria-label="Tickets" className="flex flex-col">
        {drafting ? (
          <li>
            <Link aria-current="page" className="flex items-center gap-3.5 border-l-[3px] border-primary bg-lavender-soft px-6 py-[18px]" href="/support/new">
              <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Plus className="size-[18px]" strokeWidth={1.5} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium tracking-[0.35px] text-ink">New ticket</span>
                <span className="text-xs tracking-[0.35px] text-muted">Draft</span>
              </span>
            </Link>
          </li>
        ) : null}
        {visible.map((ticket) => {
          const active = pathname === `/support/${ticket.id}`;
          const preview = ticketPreview(ticket);
          const open = ticket.status === "open";
          return (
            <li key={ticket.id}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex gap-3.5 border-l-[3px] px-6 py-[18px] transition-colors hover:bg-lavender-soft",
                  active ? "border-primary bg-lavender-soft" : "border-transparent",
                )}
                href={`/support/${ticket.id}`}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full",
                    open ? "bg-lavender text-primary" : "bg-surface-soft text-muted",
                  )}
                >
                  {open ? <MessageCircle className="size-[18px]" strokeWidth={1.5} /> : <Check className="size-[18px]" strokeWidth={1.5} />}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-medium tracking-[0.35px] text-ink">{ticket.subject}</span>
                    <time className="shrink-0 text-xs tracking-[0.35px] text-muted" dateTime={preview.at.toISOString()}>
                      {relativeTime(preview.at, now).replace(" ago", "")}
                    </time>
                  </span>
                  <span className="text-xs font-medium tracking-[0.35px] text-primary">
                    {categoryLabel(ticket.category)}
                    {ticket.orderId === null ? "" : ` · Order #${ticket.orderId}`}
                  </span>
                  {preview.text ? <span className="truncate text-xs tracking-[0.35px] text-muted">{preview.text}</span> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && !drafting ? (
        <p className="px-6 py-4 text-sm tracking-[0.35px] text-muted" role="status">
          {query.trim() ? "No tickets match your search." : tab === "open" ? "No open tickets." : "No resolved tickets yet."}
        </p>
      ) : null}
    </div>
  );
}
