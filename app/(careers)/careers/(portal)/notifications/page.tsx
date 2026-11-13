import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { NotificationsHeading } from "@/app/(careers)/careers/_components/notifications-heading";
import { CareersNotificationsSkeleton } from "@/app/(careers)/careers/_components/skeletons";
import { requireApplicant } from "@/lib/careers/current-applicant";
import { listApplicantInbox } from "@/lib/careers/inbox";

import { ApplicantNotificationsFeed } from "./applicant-notifications-feed";

export const metadata: Metadata = { title: "Notifications" };

async function NotificationsContent() {
  await requireApplicant();
  let items;
  try {
    items = await listApplicantInbox();
  } catch (error) {
    console.error("Applicant Notifications could not be loaded", error);
    return (
      <div className="flex flex-col items-start gap-4 border border-line bg-white p-8 sm:p-10" role="alert">
        <h2 className="font-serif text-2xl leading-[1.3] text-primary">We couldn&apos;t load your notifications</h2>
        <p className="leading-[1.6] tracking-[0.35px] text-body">Something went wrong on our side. Please try again in a moment.</p>
        <Link href="/careers/notifications" className="rounded-full border border-primary px-[22px] py-2.5 text-sm font-medium tracking-wide text-primary hover:bg-lavender-soft">
          Try again
        </Link>
      </div>
    );
  }
  return <ApplicantNotificationsFeed items={items} now={new Date()} />;
}

export default function ApplicantNotificationsPage() {
  return (
    <section className="mx-auto w-full max-w-[1440px] px-5 pb-[100px] pt-[50px] sm:px-10">
      <NotificationsHeading />
      <div className="mt-[30px]">
        <Suspense fallback={<CareersNotificationsSkeleton />}>
          <NotificationsContent />
        </Suspense>
      </div>
    </section>
  );
}
