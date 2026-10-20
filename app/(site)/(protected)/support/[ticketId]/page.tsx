import { ArrowLeft, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConversationSkeleton } from "@/components/features/support/skeletons";
import { TicketThread } from "@/components/features/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { completeTicket, reportTicketNotFixed } from "@/app/(site)/(protected)/support/actions";
import { formatPeso } from "@/lib/catalog/currency";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { orderTotalInCentavos } from "@/lib/orders/order-view";
import { createOrderStore } from "@/lib/orders/orders";
import { categoryLabel } from "@/lib/support/inbox";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "Support Ticket" };
export const dynamic = "force-dynamic";

/** Streams in one Customer-owned Ticket and its Message thread. */
async function TicketDetail({ params }: { params: PageProps<"/support/[ticketId]">["params"] }) {
  const { ticketId: ticketIdParam } = await params;
  const ticketId = positiveIntegerField("Ticket ID").safeParse(ticketIdParam);
  if (!ticketId.success) notFound();

  const customer = await requireCustomer();
  const database = getDatabase();
  const ticket = await createTicketStore(database).get(ticketId.data, customer.userId);
  if (!ticket) notFound();
  const currentTicketId = ticket.id;
  const relatedOrder = ticket.orderId === null
    ? undefined
    : (await createOrderStore(database).listForCustomer(customer.userId)).find((order) => order.id === ticket.orderId);

  async function complete() {
    "use server";
    await completeTicket(currentTicketId);
  }

  async function notFixed() {
    "use server";
    await reportTicketNotFixed(currentTicketId);
  }

  const status = ticket.status === "completed" ? "completed" : ticket.status === "resolved" ? "resolved" : "open";
  const statusLabel = { open: "Open", resolved: "Resolved", completed: "Completed" }[status];

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-[22px] sm:px-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline" href="/support">
            <ArrowLeft aria-hidden className="size-4" />
            All tickets
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[22px] leading-[1.3] text-primary">{ticket.subject}</h2>
            <span className={status === "completed" ? "rounded-full bg-surface-soft px-3 py-1 text-xs font-medium tracking-[0.35px] text-body" : "rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary"}>
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tracking-[0.35px] text-muted">
            <span>Ticket #{ticket.id} · {categoryLabel(ticket.category)}</span>
            {relatedOrder ? (
              <Link
                className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-primary transition-colors hover:bg-lavender-soft"
                href="/profile/orders"
              >
                <Package aria-hidden className="size-3.5" strokeWidth={1.5} />
                Order #{relatedOrder.id} · {formatPeso(orderTotalInCentavos(relatedOrder))}
              </Link>
            ) : null}
          </div>
        </div>
        {status === "open" ? (
          <form action={complete}>
            <Button size="pill-sm" type="submit" variant="pill-outline">
              Mark as completed
            </Button>
          </form>
        ) : null}
      </div>
      {status === "resolved" ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-lavender-soft px-5 py-4 sm:px-8">
          <p className="text-sm tracking-[0.35px] text-ink">Our team marked this Ticket as resolved. Is it fixed?</p>
          <div className="flex flex-wrap gap-2">
            <form action={complete}>
              <Button size="pill-sm" type="submit">
                Yes, it&apos;s fixed
              </Button>
            </form>
            <form action={notFixed}>
              <Button size="pill-sm" type="submit" variant="pill-outline">
                Not fixed
              </Button>
            </form>
          </div>
        </div>
      ) : null}
      <TicketThread completed={status === "completed"} createdAt={ticket.createdAt} messages={ticket.messages} ticketId={ticket.id} />
    </div>
  );
}

/** The panel's right pane streams in behind a skeleton while the inbox column stays put. */
export default function TicketDetailPage({ params }: PageProps<"/support/[ticketId]">) {
  return (
    <Suspense fallback={<ConversationSkeleton />}>
      <TicketDetail params={params} />
    </Suspense>
  );
}
