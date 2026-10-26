import type { Metadata } from "next";
import { Suspense } from "react";

import { NotificationsFeed } from "@/components/features/customer/notifications-feed";
import { NotificationsSkeleton } from "@/components/features/customer/skeletons";
import { PageHeading } from "@/components/ui/page-heading";
import { requireCustomer } from "@/lib/customer/current-visitor";
import { listInbox } from "@/lib/notifications/inbox";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

async function NotificationsContent() {
  const customer = await requireCustomer();
  return <NotificationsFeed items={await listInbox(customer.userId)} now={new Date()} />;
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
