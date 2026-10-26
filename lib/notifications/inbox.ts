import { z } from "zod";

/** The App name the notifications service files the storefront's Customers under. */
const app = "ecommerce";
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

type Gateway = { baseUrl?: string; callerKey?: string; fetch?: typeof fetch };

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

const inbox = (customerId: string) => new URLSearchParams({ userId: customerId, app });

/** The Customer's stored Notifications from the notifications service, newest first. */
export async function listInbox(customerId: string, gateway: Gateway = {}): Promise<InboxNotification[]> {
  const query = inbox(customerId);
  query.set("limit", String(listLimit));
  const page = await call(gateway, `/notifications/notifications?${query}`, "inbox");
  return z.object({ notifications: z.array(storedNotification) }).parse(page).notifications.map(
    ({ id, type, title, body, link, createdAt, readAt }) => ({ id, type, title, body, link, createdAt, readAt }),
  );
}

export async function unreadInboxCount(customerId: string, gateway: Gateway = {}): Promise<number> {
  const result = await call(gateway, `/notifications/notifications/unread-count?${inbox(customerId)}`, "unread count");
  return z.object({ unread: z.number() }).parse(result).unread;
}

/** Marks one of this Customer's Notifications read; the service refuses anyone else's. */
export async function markInboxRead(customerId: string, id: string, gateway: Gateway = {}): Promise<void> {
  if (!z.uuid().safeParse(id).success) throw new Error("Not a Notification id.");
  await call(gateway, `/notifications/notifications/${id}/read`, "read mark", { body: { userId: customerId, app } });
}

export async function markAllInboxRead(customerId: string, gateway: Gateway = {}): Promise<void> {
  await call(gateway, "/notifications/notifications/read-all", "read mark", { body: { userId: customerId, app } });
}

/**
 * The address a Customer's browser opens to receive their own Notifications live. The gateway's pass names that
 * Customer alone and expires within about a minute, so the browser can never listen for anyone else's.
 */
export async function liveInboxUrl(customerId: string, gateway: Gateway = {}): Promise<string> {
  const { base, callerKey, send } = connection(gateway);
  const response = await send(`${base}/live-tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${callerKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ userId: customerId }),
  });
  if (!response.ok) throw new Error(`The gateway refused a Notifications pass: ${response.status}`);

  const { ticket } = (await response.json()) as { ticket: string };
  return `${base.replace(/^http/, "ws")}/notifications/live?ticket=${encodeURIComponent(ticket)}`;
}
