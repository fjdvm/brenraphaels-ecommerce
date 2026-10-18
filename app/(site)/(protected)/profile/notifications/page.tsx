import type { Metadata } from "next";
import { Suspense } from "react";

import { NotificationsFeed } from "@/components/features/customer/notifications-feed";
import { NotificationsSkeleton } from "@/components/features/customer/skeletons";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { deriveNotifications } from "@/lib/notifications/derive";
import { createOrderStore } from "@/lib/orders/orders";
import { createTicketStore } from "@/lib/support/tickets";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

async function NotificationsContent() {
  const customer = await requireCustomer();
  const database = getDatabase();
  const [orders, tickets] = await Promise.all([
    createOrderStore(database).listForCustomer(customer.userId),
    createTicketStore(database).listForCustomer(customer.userId),
  ]);

  return <NotificationsFeed items={deriveNotifications({ orders, tickets })} now={new Date()} />;
}

export default function NotificationsPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="Notifications" />
      <Suspense fallback={<NotificationsSkeleton />}>
        <NotificationsContent />
      </Suspense>
    </section>
  );
}
