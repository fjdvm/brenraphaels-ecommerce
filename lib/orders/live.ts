/** What the gateway relays to a Customer's open Orders page: invalidation signals that name what changed, never its details. */
export type OrdersLiveEvent =
  | { type: "order.updated"; orderId: string }
  | { type: "return.updated"; orderId: string; returnId: string };

/** An open line carrying the signed-in Customer's own Order and Return events. */
export type OrdersLiveConnection = { close(): void };

/**
 * The live Orders boundary: opens the line and reports what arrives. `onClose` fires when the line drops, so
 * the caller can reconnect. Tests replace this with a fake; the real one is components/features/orders/live-socket.ts.
 */
export type ConnectOrdersLive = (handlers: {
  onOpen(): void;
  onEvent(event: OrdersLiveEvent): void;
  onClose(): void;
}) => OrdersLiveConnection;

type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

/**
 * The address a Customer's browser opens to receive their own Order events. The gateway's Orders pass names
 * that Customer alone and expires within about a minute, so the browser can never subscribe to anyone else's.
 */
export async function liveOrdersUrl(
  customerId: string,
  { baseUrl = process.env.API_GATEWAY_URL, callerKey = process.env.API_GATEWAY_CALLER_KEY, fetch: send = fetch }: Gateway = {},
): Promise<string> {
  if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_CALLER_KEY must be set.");
  const base = baseUrl.replace(/\/$/, "");

  const response = await send(`${base}/live-tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: customerId, channel: "orders" }),
  });
  if (!response.ok) throw new Error(`The gateway refused an Orders pass: ${response.status}`);

  const { ticket } = (await response.json()) as { ticket: string };
  return `${base.replace(/^http/, "ws")}/notifications/orders/live?ticket=${encodeURIComponent(ticket)}`;
}
