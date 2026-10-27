"use client";

import { applicantNotificationsLiveUrl } from "@/app/(careers)/careers/(portal)/notifications/actions";
import { LiveNotifications } from "@/components/features/customer/live-notifications";
import { openNotificationsLive } from "@/components/features/customer/live-notifications-socket";
import type { ConnectNotificationsLive } from "@/lib/notifications/live";

const connect: ConnectNotificationsLive = (handlers) => openNotificationsLive(applicantNotificationsLiveUrl, handlers);

/** Keeps the Applicant's bell and inbox current in every open tab. */
export function LiveApplicantNotifications() {
  return <LiveNotifications connect={connect} />;
}
