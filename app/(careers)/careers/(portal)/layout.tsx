import { Suspense } from "react";

import { CareersFooter } from "@/components/features/careers/careers-footer";
import { LiveApplicantNotifications } from "@/components/features/careers/live-applicant-notifications";
import { CareersHeader, CareersHeaderFallback } from "@/components/features/careers/careers-header";
import { careersSession } from "@/lib/careers/auth";

/** Opens the Applicant's live Notifications line, which refreshes the bell and inbox in every open tab. */
async function LiveNotificationsGate() {
  return (await careersSession()) ? <LiveApplicantNotifications /> : null;
}

export default function CareersPortalLayout({ children }: LayoutProps<"/careers">) {
  return (
    <>
      <Suspense fallback={null}>
        <LiveNotificationsGate />
      </Suspense>
      <Suspense fallback={<CareersHeaderFallback />}>
        <CareersHeader />
      </Suspense>
      <main className="flex-1 bg-surface text-on-surface">{children}</main>
      <CareersFooter />
    </>
  );
}
