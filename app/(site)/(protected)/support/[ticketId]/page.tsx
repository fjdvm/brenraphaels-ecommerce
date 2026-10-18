import { ArrowLeft, Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ConversationSkeleton } from "@/components/features/support/skeletons";
import { TicketThread } from "@/components/features/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { closeTicket, reopenTicket } from "@/app/(site)/(protected)/support/actions";
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

  async function close() {
    "use server";
    await closeTicket(currentTicketId);
  }

  async function reopen() {
    "use server";
    await reopenTicket(currentTicketId);
  }

  const open = ticket.status === "open";

  return (
    <div className="flex min-h-[600px] flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-6 sm:px-8">
        <div className="flex min-w-0 flex-col gap-2">
          <Link className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline lg:hidden" href="/support">
            <ArrowLeft aria-hidden className="size-4" />
            All tickets
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-serif text-[28px] leading-[1.25] text-primary">{ticket.subject}</h2>
            <span className={open ? "rounded-full bg-lavender px-3 py-1 text-xs font-medium tracking-[0.35px] text-primary" : "rounded-full bg-surface-soft px-3 py-1 text-xs font-medium tracking-[0.35px] text-body"}>
              {open ? "Open" : "Resolved"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs tracking-[0.35px] text-muted">
            <span>Ticket #{ticket.id} · {categoryLabel(ticket.category)}</span>
            {relatedOrder ? (
              <Link
                className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 font-medium text-primary transition-colors hover:bg-lavender-soft"
                href="/profile/orders"
              >
                <Package aria-hidden className="size-3.5" strokeWidth={1.5} />
                Order #{relatedOrder.id} · {formatPeso(orderTotalInCentavos(relatedOrder))}
              </Link>
            ) : null}
          </div>
        </div>
        <form action={open ? close : reopen}>
          <Button size="pill-sm" type="submit" variant="pill-outline">
            {open ? "Mark as resolved" : "Reopen ticket"}
          </Button>
        </form>
      </div>
      <TicketThread messages={ticket.messages} ticketId={ticket.id} />
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
