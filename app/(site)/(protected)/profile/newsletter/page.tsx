import type { Metadata } from "next";
import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
export const metadata: Metadata = { title: "My newsletters" };
export default function NewsletterPage() {
  return (
    <AccountEmptyState
      title="My newsletters"
      description="Newsletter preferences will be available here soon."
    />
  );
}
