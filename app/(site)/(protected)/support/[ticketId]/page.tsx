import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { TicketDetailSkeleton } from "@/components/features/support/skeletons";
import { TicketThread } from "@/components/features/support/ticket-thread";
import { Button } from "@/components/ui/button";
import { closeTicket, reopenTicket } from "@/app/(site)/(protected)/support/actions";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
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
  const ticket = await createTicketStore(getDatabase()).get(ticketId.data, customer.userId);
  if (!ticket) notFound();
  const currentTicketId = ticket.id;

  async function close() {
    "use server";
    await closeTicket(currentTicketId);
  }

  async function reopen() {
    "use server";
    await reopenTicket(currentTicketId);
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">{ticket.category}</p>
          <h2 className="font-serif text-3xl text-primary">{ticket.subject}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-primary">{ticket.status}</span>
          {ticket.status === "open" ? (
            <form action={close}>
              <Button type="submit" variant="outline">Close Ticket</Button>
            </form>
          ) : ticket.status === "closed" || ticket.status === "resolved" ? (
            <form action={reopen}>
              <Button type="submit">Reopen Ticket</Button>
            </form>
          ) : null}
        </div>
      </div>
      <TicketThread ticketId={ticket.id} messages={ticket.messages} />
    </>
  );
}

/** Renders the back link instantly; the Ticket streams in behind a skeleton. */
export default function TicketDetailPage({ params }: PageProps<"/support/[ticketId]">) {
  return (
    <section>
      <Link className="text-sm font-semibold text-primary underline" href="/support">Back to Support</Link>
      <Suspense fallback={<TicketDetailSkeleton />}>
        <TicketDetail params={params} />
      </Suspense>
    </section>
  );
}
