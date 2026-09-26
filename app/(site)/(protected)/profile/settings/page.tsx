import type { Metadata } from "next";
import { AccountEmptyState } from "@/components/features/customer/account-empty-state";
export const metadata: Metadata = { title: "Account settings" };
export default function SettingsPage() {
  return (
    <AccountEmptyState
      title="Account settings"
      description="Additional account settings will be available here soon."
    />
  );
}
