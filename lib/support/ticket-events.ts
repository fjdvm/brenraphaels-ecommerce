import { createClient } from "redis";

import type { TicketEvent, TicketMessage } from "./tickets";

/** What subscribers of a Ticket's channel receive; dates travel as ISO strings. */
export type TicketEventPayload = {
  type: TicketEvent["type"];
  ticketId: number;
  status: string;
  message: Omit<TicketMessage, "createdAt"> & { createdAt: string };
};

const ticketChannel = (ticketId: number) => `ticket:${ticketId}`;

function connect() {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required for realtime Ticket updates.");
  const client = createClient({ url });
  // A dropped connection reconnects on its own; without a listener the error event would crash the process.
  client.on("error", (error) => console.error("Redis client error", error));
  return client;
}

type RedisClient = ReturnType<typeof connect>;

/** Connects on first use and reuses the connection; a failed attempt is retried on the next call. */
function lazyClient() {
  let pending: Promise<RedisClient> | undefined;
  return () => {
    if (!pending) {
      const attempt = connect().connect();
      attempt.catch(() => {
        if (pending === attempt) pending = undefined;
      });
      pending = attempt;
    }
    return pending;
  };
}

const publisher = lazyClient();
const subscriber = lazyClient();

/** Publishes a stored Ticket event to that Ticket's channel. */
export async function publishTicketEvent(event: TicketEvent): Promise<void> {
  const client = await publisher();
  const payload: TicketEventPayload = {
    type: event.type,
    ticketId: event.ticket.id,
    status: event.ticket.status,
    message: { ...event.message, createdAt: event.message.createdAt.toISOString() },
  };
  await client.publish(ticketChannel(event.ticket.id), JSON.stringify(payload));
}

/**
 * Listens to one Ticket's channel. Every listener in this instance shares a single Redis
 * subscriber connection, so open tabs do not each use one of the provider's connections.
 */
export async function subscribeToTicket(
  ticketId: number,
  listener: (payload: TicketEventPayload) => void,
): Promise<() => Promise<void>> {
  const client = await subscriber();
  const channel = ticketChannel(ticketId);
  const onMessage = (raw: string) => listener(JSON.parse(raw) as TicketEventPayload);
  await client.subscribe(channel, onMessage);
  return async () => {
    await client.unsubscribe(channel, onMessage);
  };
}
