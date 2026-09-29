import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketThread } from "@/components/features/support/ticket-thread";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

export const metadata: Metadata = { title: "Support Ticket" };
export const dynamic = "force-dynamic";

/** Shows one Customer-owned Ticket and its Message thread. */
export default async function TicketDetailPage({ params }: PageProps<"/support/[ticketId]">) {
  const { ticketId: ticketIdParam } = await params;
  const ticketId = positiveIntegerField("Ticket ID").safeParse(ticketIdParam);
  if (!ticketId.success) notFound();

  const customer = await requireCustomer();
  const ticket = await createTicketStore(getDatabase()).get(ticketId.data, customer.userId);
  if (!ticket) notFound();

  return (
    <section>
      <Link className="text-sm font-semibold text-primary underline" href="/support">Back to Support</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-on-surface-variant">{ticket.category}</p>
          <h2 className="font-serif text-3xl text-primary">{ticket.subject}</h2>
        </div>
        <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-primary">{ticket.status}</span>
      </div>
      <TicketThread ticketId={ticket.id} messages={ticket.messages} />
    </section>
  );
}
