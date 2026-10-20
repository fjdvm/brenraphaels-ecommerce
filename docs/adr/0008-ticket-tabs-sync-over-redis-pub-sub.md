> **Superseded.** Ticket threads are now live through the api-gateway's Live ticket and the notifications service's conversation relay, for the Customer's tabs and for Staff replies from CREOMS alike. The Redis pub/sub, its `/events` route and `REDIS_URL` are gone. The browser relays a Message after it is saved; the relay stores nothing, and a failed relay is caught up by reloading the saved thread.

# Ticket threads sync across a Customer's tabs over Redis pub/sub

A Customer's open tabs on one Ticket stay in sync through Redis (Vercel Marketplace, free plan) rather than through Neon `LISTEN`/`NOTIFY`. The Ticket store takes an injected `publish` dependency and calls it after `.open()` and `.addMessage()`; `GET /api/support/tickets/[ticketId]/events` re-checks that the Customer owns the Ticket and streams the channel to the browser as Server-Sent Events. Neon `LISTEN` needs the unpooled connection and holds one database connection (and the compute awake) per open tab, which is the wrong load to put on the database that is the source of truth for Tickets.

## Consequences

- Redis is a delivery channel only. Messages are saved in Neon first; a failed or slow publish is logged and dropped, and tabs catch up by reloading the saved thread whenever the stream connects.
- Only this app's store publishes. Staff Messages that CREOMS writes straight into the shared database (ADR-0007) never reach the stream, so this syncs a Customer's own tabs, not staff replies. CREOMS would have to publish to the same `ticket:<id>` channel to change that.
- The free plan allows 30 connections and has no high availability. Each server instance shares one subscriber connection across all its open tabs.
