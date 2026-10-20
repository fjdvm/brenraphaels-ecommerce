"use client";

import { ticketLiveUrl } from "@/app/(site)/(protected)/support/actions";
import type { ConnectLive, LiveEvent } from "@/lib/support/live";

/** The real Live ticket boundary: asks the server for a Live ticket, then opens the gateway's WebSocket. */
export const connectLive: ConnectLive = (ticketId, { onOpen, onEvent, onClose }) => {
  let socket: WebSocket | undefined;
  let closed = false;

  void ticketLiveUrl(ticketId)
    .then((url) => {
      if (closed) return;
      if (!url) return onClose();

      socket = new WebSocket(url);
      socket.onopen = onOpen;
      socket.onclose = onClose;
      socket.onmessage = (event) => {
        try {
          onEvent(JSON.parse(String(event.data)) as LiveEvent);
        } catch {
          // A frame the storefront cannot read is ignored; the database stays the source of truth.
        }
      };
    })
    .catch(() => onClose());

  return {
    send(frame) {
      if (socket?.readyState !== WebSocket.OPEN) throw new Error("The live line is not open");
      socket.send(JSON.stringify(frame));
    },
    close() {
      closed = true;
      socket?.close();
    },
  };
};
