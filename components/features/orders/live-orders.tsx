"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { connectOrdersLive } from "@/components/features/orders/live-socket";
import type { ConnectOrdersLive, OrdersLiveConnection } from "@/lib/orders/live";

const reconnectMilliseconds = 3_000;

/**
 * Keeps the Customer's Orders page current. Staff moving an Order or deciding a Return sends an invalidation
 * signal; the page then refetches the saved Orders, so the card, Delivery photo and Return all come from the
 * database. Events are not replayed, so every connect, including a reconnect, refetches too.
 */
export function LiveOrders({ connect = connectOrdersLive }: { connect?: ConnectOrdersLive }) {
  const router = useRouter();
  const refresh = useRef(router.refresh);
  useEffect(() => {
    refresh.current = router.refresh;
  });

  useEffect(() => {
    let stopped = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let line: OrdersLiveConnection | null = null;

    const open = () => {
      line = connect({
        onOpen: () => refresh.current(),
        onEvent: (event) => {
          if (event?.type === "order.updated" || event?.type === "return.updated") refresh.current();
        },
        onClose: () => {
          line = null;
          if (!stopped) retry = setTimeout(open, reconnectMilliseconds);
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
