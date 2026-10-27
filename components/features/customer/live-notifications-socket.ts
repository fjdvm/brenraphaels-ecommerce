"use client";

import { notificationsLiveUrl } from "@/app/(site)/(protected)/profile/notifications/actions";
import type { ConnectNotificationsLive, NotificationsLiveEvent } from "@/lib/notifications/live";

/** Asks the server for the signed-in recipient's pass with `issueUrl`, then opens the gateway's WebSocket. */
export const openNotificationsLive = (
  issueUrl: () => Promise<string | null>,
  ...[{ onOpen, onEvent, onClose }]: Parameters<ConnectNotificationsLive>
): ReturnType<ConnectNotificationsLive> => {
  let socket: WebSocket | undefined;
  let closed = false;

  void issueUrl()
    .then((url) => {
      if (closed) return;
      if (!url) return onClose();

      socket = new WebSocket(url);
      socket.onopen = onOpen;
      socket.onclose = onClose;
      socket.onmessage = (event) => {
        try {
          onEvent(JSON.parse(String(event.data)) as NotificationsLiveEvent);
        } catch {
          // A frame the page cannot read is ignored; the inbox stays the source of truth.
        }
      };
    })
    .catch(() => onClose());

  return {
    close() {
      closed = true;
      socket?.close();
    },
  };
};

/** The real live Notifications boundary for the storefront Customer. */
export const connectNotificationsLive: ConnectNotificationsLive = (handlers) => openNotificationsLive(notificationsLiveUrl, handlers);
