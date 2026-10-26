"use client";

import { ordersLiveUrl } from "@/app/(site)/(protected)/profile/orders/actions";
import type { ConnectOrdersLive, OrdersLiveEvent } from "@/lib/orders/live";

/** The real live Orders boundary: asks the server for the Customer's Orders pass, then opens the gateway's WebSocket. */
export const connectOrdersLive: ConnectOrdersLive = ({ onOpen, onEvent, onClose }) => {
  let socket: WebSocket | undefined;
  let closed = false;

  void ordersLiveUrl()
    .then((url) => {
      if (closed) return;
      if (!url) return onClose();

      socket = new WebSocket(url);
      socket.onopen = onOpen;
      socket.onclose = onClose;
      socket.onmessage = (event) => {
        try {
          onEvent(JSON.parse(String(event.data)) as OrdersLiveEvent);
        } catch {
          // A frame the storefront cannot read is ignored; the database stays the source of truth.
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
