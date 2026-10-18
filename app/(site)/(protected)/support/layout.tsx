import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { BackButton } from "@/components/shared/back-button";
import { SupportInboxSkeleton } from "@/components/features/support/skeletons";
import { SupportInbox } from "@/components/features/support/support-inbox";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { createTicketStore } from "@/lib/support/tickets";

/** Streams in the Customer's Tickets for the inbox column. */
async function Inbox() {
  const customer = await requireCustomer();
  const tickets = await createTicketStore(getDatabase()).listForCustomer(customer.userId);
  return (
    <SupportInbox
      now={new Date()}
      tickets={tickets.map(({ id, subject, category, orderId, status, createdAt, messages }) => ({
        id,
        subject,
        category,
        orderId,
        status,
        createdAt,
        messages: messages.map(({ sender, body, createdAt: sentAt }) => ({ sender, body, createdAt: sentAt })),
      }))}
    />
  );
}

/** The static shell of Support: the heading and the two-column panel; the inbox and the right pane stream in. */
export default function SupportLayout({ children }: { children: ReactNode }) {
  return (
    <section className="flex w-full flex-col gap-[30px] px-5 pb-[100px] pt-6 sm:px-10">
      <div className="-mb-3">
        <BackButton fallbackHref="/profile/orders" />
      </div>
      <PageHeading
        aside={
          <Button asChild size="pill-lg" variant="pill">
            <Link href="/support/new">
              New ticket
              <ArrowRight aria-hidden className="size-5" />
            </Link>
          </Button>
        }
        eyebrow="Customer care"
        title="Support"
      />
      <div className="grid min-h-[640px] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-[40px] border border-line bg-white lg:h-[820px] lg:grid-cols-[400px_minmax(0,1fr)]">
        <Suspense fallback={<SupportInboxSkeleton />}>
          <Inbox />
        </Suspense>
        <div className="h-full min-h-0 min-w-0">{children}</div>
      </div>
    </section>
  );
}
