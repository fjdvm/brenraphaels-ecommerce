import type { Metadata } from "next";

import { FeedbackForm } from "@/components/features/feedback/feedback-form";
import { SettingsCard } from "@/components/features/customer/settings-card";
import { PageHeading } from "@/components/ui/page-heading";

export const metadata: Metadata = { title: "Feedback" };

// Nothing here awaits data, so the whole page is a static shell.
export default function FeedbackPage() {
  return (
    <section className="flex flex-col gap-[30px]">
      <PageHeading eyebrow="My account" title="Feedback" />
      <SettingsCard
        title="Send feedback"
        description="Tell us what went wrong or what we could improve."
      >
        <FeedbackForm />
      </SettingsCard>
    </section>
  );
}
