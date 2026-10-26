"use client";

import { notificationsLiveUrl } from "@/app/(site)/(protected)/profile/notifications/actions";
import type { ConnectNotificationsLive, NotificationsLiveEvent } from "@/lib/notifications/live";

/** The real live Notifications boundary: asks the server for the Customer's pass, then opens the gateway's WebSocket. */
export const connectNotificationsLive: ConnectNotificationsLive = ({ onOpen, onEvent, onClose }) => {
  let socket: WebSocket | undefined;
  let closed = false;

  void notificationsLiveUrl()
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
          // A frame the storefront cannot read is ignored; the inbox stays the source of truth.
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
