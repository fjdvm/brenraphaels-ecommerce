"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { storefrontLiveUrl } from "@/app/(site)/storefront-live-actions";
import { openNotificationsLive } from "@/components/features/customer/live-notifications-socket";
import type { ConnectNotificationsLive, NotificationsLiveConnection } from "@/lib/notifications/live";

const firstRetryMilliseconds = 3_000;
const longestRetryMilliseconds = 60_000;

const connectStorefrontLive: ConnectNotificationsLive = (handlers) => openNotificationsLive(storefrontLiveUrl, handlers);

/**
 * Keeps shop-wide settings current on every open page, signed in or not: when CREOMS says one changed (the Free delivery
 * threshold in the banner), the page refetches what it shows. The nudge carries no value. A page that has just loaded
 * does not refetch on its first connect; a reconnect does, since events are not replayed.
 */
export function LiveStorefront({ connect = connectStorefrontLive }: { connect?: ConnectNotificationsLive }) {
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
    let connectedBefore = false;

    const open = () => {
      line = connect({
        onOpen: () => {
          wait = firstRetryMilliseconds;
          if (connectedBefore) refresh.current();
          connectedBefore = true;
        },
        onEvent: (event) => {
          if (event?.type === "notification.created") refresh.current();
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
