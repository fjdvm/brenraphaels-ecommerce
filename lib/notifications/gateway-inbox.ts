import { z } from "zod";

const listLimit = 50;

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: Date;
  readAt: Date | null;
};

export type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

const storedNotification = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  body: z.string(),
  link: z.string().nullable(),
  createdAt: z.coerce.date(),
  readAt: z.coerce.date().nullable(),
});

function connection({ baseUrl = process.env.API_GATEWAY_URL, callerKey = process.env.API_GATEWAY_CALLER_KEY, fetch: send = fetch }: Gateway) {
  if (!baseUrl || !callerKey) throw new Error("API_GATEWAY_URL and API_GATEWAY_CALLER_KEY must be set.");
  return { base: baseUrl.replace(/\/$/, ""), callerKey, send };
}

async function call(gateway: Gateway, path: string, what: string, init: { body?: unknown } = {}): Promise<unknown> {
  const { base, callerKey, send } = connection(gateway);
  const response = await send(`${base}${path}`, {
    method: init.body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${callerKey}`, ...(init.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    // A hung gateway must not hold the page.
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`The gateway refused the ${what}: ${response.status}`);
  return response.json();
}

/** A server-side inbox scoped to one App. Recipient ids must come from the signed-in session. */
export function createGatewayInbox(app: "ecommerce" | "careers", defaultGateway: Gateway = {}) {
  const inbox = (recipientId: string) => new URLSearchParams({ userId: recipientId, app });

  /** The recipient's stored Notifications from the notifications service, newest first. */
  async function listInbox(recipientId: string, gateway: Gateway = defaultGateway): Promise<InboxNotification[]> {
    const query = inbox(recipientId);
    query.set("limit", String(listLimit));
    const page = await call(gateway, `/notifications/notifications?${query}`, "inbox");
    return z.object({ notifications: z.array(storedNotification) }).parse(page).notifications.map(
      ({ id, type, title, body, link, createdAt, readAt }) => ({ id, type, title, body, link, createdAt, readAt }),
    );
  }

  async function unreadInboxCount(recipientId: string, gateway: Gateway = defaultGateway): Promise<number> {
    const result = await call(gateway, `/notifications/notifications/unread-count?${inbox(recipientId)}`, "unread count");
    return z.object({ unread: z.number() }).parse(result).unread;
  }

  /** Marks one of this recipient's Notifications read; the service refuses anyone else's. */
  async function markInboxRead(recipientId: string, id: string, gateway: Gateway = defaultGateway): Promise<void> {
    if (!z.uuid().safeParse(id).success) throw new Error("Not a Notification id.");
    await call(gateway, `/notifications/notifications/${id}/read`, "read mark", { body: { userId: recipientId, app } });
  }

  async function markAllInboxRead(recipientId: string, gateway: Gateway = defaultGateway): Promise<void> {
    await call(gateway, "/notifications/notifications/read-all", "read mark", { body: { userId: recipientId, app } });
  }

  /**
   * The address a recipient's browser opens to receive their own Notifications live. The gateway's pass names that
   * recipient alone and expires within about a minute, so the browser can never listen for anyone else's.
   */
  async function liveInboxUrl(recipientId: string, gateway: Gateway = defaultGateway): Promise<string> {
    const { base } = connection(gateway);
    const pass = await call(gateway, "/live-tickets", "Notifications pass", { body: { userId: recipientId } });
    const { ticket } = z.object({ ticket: z.string() }).parse(pass);
    return `${base.replace(/^http/, "ws")}/notifications/live?ticket=${encodeURIComponent(ticket)}`;
  }

  return { listInbox, unreadInboxCount, markInboxRead, markAllInboxRead, liveInboxUrl };
}
