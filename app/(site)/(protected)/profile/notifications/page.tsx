import type { Metadata } from "next";

import { AccountEmptyState } from "@/components/features/customer/account-empty-state";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <AccountEmptyState
      title="Notifications"
      description="Updates about your orders and account will appear here."
    />
  );
}
