import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { OpenTicketForm } from "@/components/features/support/open-ticket-form";
import { SupportContentSkeleton } from "@/components/features/support/skeletons";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createOrderStore } from "@/lib/orders/orders";
import { createTicketStore } from "@/lib/support/tickets";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

/** Streams in a Customer's Ticket history and the form to start a new one. */
async function SupportContent() {
  const customer = await requireCustomer();
  const database = getDatabase();
  const [tickets, orders] = await Promise.all([
    createTicketStore(database).listForCustomer(customer.userId),
    createOrderStore(database).listForCustomer(customer.userId),
  ]);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div>
        <h3 className="font-serif text-2xl text-primary">Your Tickets</h3>
        {tickets.length === 0 ? (
          <p className="mt-4 rounded-md border border-outline-variant/60 bg-surface-card p-5 text-on-surface-variant">You have no Support Tickets yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link className="block rounded-md border border-outline-variant/60 bg-surface-card p-5 transition-colors hover:bg-primary-fixed" href={`/support/${ticket.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h4 className="font-semibold text-primary">{ticket.subject}</h4>
                    <span className="rounded-full bg-primary-fixed px-3 py-1 text-sm font-semibold text-primary">{ticket.status}</span>
                  </div>
                  <p className="mt-2 text-sm text-on-surface-variant">{ticket.category}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <OpenTicketForm orders={orders.map(({ id }) => ({ id }))} />
    </div>
  );
}

/** Renders the heading instantly; the Ticket data streams in behind a skeleton. */
export default function SupportPage() {
  return (
    <section>
      <h2 className="font-serif text-3xl text-primary">Support</h2>
      <p className="mt-2 text-on-surface-variant">Open a Ticket and keep track of your conversations with us.</p>
      <Suspense fallback={<SupportContentSkeleton />}>
        <SupportContent />
      </Suspense>
    </section>
  );
}
