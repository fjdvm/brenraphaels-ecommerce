"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { connectNotificationsLive } from "@/components/features/customer/live-notifications-socket";
import type { ConnectNotificationsLive, NotificationsLiveConnection } from "@/lib/notifications/live";

const firstRetryMilliseconds = 3_000;
const longestRetryMilliseconds = 60_000;

/**
 * Keeps the Customer's bell and Notifications page current in every open tab. A new or newly read Notification
 * makes the page refetch the stored inbox. Events are not replayed, so every connect, including a reconnect,
 * refetches too: anything that arrived while the Customer was offline is waiting then.
 */
export function LiveNotifications({ connect = connectNotificationsLive }: { connect?: ConnectNotificationsLive }) {
  const router = useRouter();
  const refresh = useRef(router.refresh);
  useEffect(() => {
    refresh.current = router.refresh;
  });

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let line: NotificationsLiveConnection | null = null;
    let wait = firstRetryMilliseconds;

    const open = () => {
      line = connect({
        onOpen: () => {
          wait = firstRetryMilliseconds;
          refresh.current();
        },
        onEvent: (event) => {
          if (event?.type === "notification.created" || event?.type === "notifications.read") refresh.current();
        },
        onClose: () => {
          line = null;
          // Back off so a gateway that stays down or unconfigured is not hit every few seconds forever.
          if (!stopped) retry = setTimeout(open, wait);
          wait = Math.min(wait * 2, longestRetryMilliseconds);
        },
      });
    };

    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      line?.close();
    };
  }, [connect]);

  return null;
}
