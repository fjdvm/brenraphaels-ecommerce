/** What the relay sends the browser; the only frames the storefront reads. */
export type LiveEvent =
  | { type: "message"; id: string; from: { userId: string; role: "Customer" | "Staff" }; text: string; sentAt: string }
  | { type: "message.delivered"; id: string; delivered: number }
  | { type: "presence"; event: "connected" | "disconnected"; userId: string; role: "Customer" | "Staff" }
  | { type: "error"; code: string; message: string; id?: string };

/** An open line into one Ticket's Conversation. */
export type LiveConnection = {
  send(frame: { type: "message"; id: string; text: string }): void;
  close(): void;
};

/**
 * The Live ticket boundary: opens the line and reports what arrives. `onClose` fires when the line
 * drops, so the caller can reconnect. Tests replace this with a fake; the real one is live-socket.ts.
 */
export type ConnectLive = (
  ticketId: number,
  handlers: { onOpen(): void; onEvent(event: LiveEvent): void; onClose(): void },
) => LiveConnection;

type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

/**
 * The address a Customer's browser opens to join their Ticket's Conversation. The gateway's Live ticket
 * names the Customer, the Ticket and the Customer role, and expires within about a minute.
 */
export async function liveConversationUrl(
  ticketId: number,
  customerId: string,
  { baseUrl = process.env.API_GATEWAY_URL, callerKey = process.env.API_GATEWAY_CALLER_KEY, fetch: send = fetch }: Gateway = {},
): Promise<string> {
  if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_CALLER_KEY must be set.");
  const base = baseUrl.replace(/\/$/, "");

  const response = await send(`${base}/live-tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: customerId, ticketId: String(ticketId), role: "Customer" }),
  });
  if (!response.ok) throw new Error(`The gateway refused a Live ticket: ${response.status}`);

  const { ticket } = (await response.json()) as { ticket: string };
  return `${base.replace(/^http/, "ws")}/notifications/conversations/${ticketId}/live?ticket=${encodeURIComponent(ticket)}`;
}
