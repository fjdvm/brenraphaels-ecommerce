import type { Metadata } from "next";
import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
export const metadata: Metadata = { title: "My orders" };
export default function OrdersPage() {
  return (
    <AccountEmptyState
      title="My orders"
      description="Your past and upcoming orders will appear here."
    />
  );
}
