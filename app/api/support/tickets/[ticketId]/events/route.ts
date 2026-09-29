import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { subscribeToTicket } from "@/lib/support/ticket-events";
import { createTicketStore } from "@/lib/support/tickets";
import { positiveIntegerField } from "@/lib/validators/fields";

export const dynamic = "force-dynamic";
// The stream ends at the platform limit; the browser's EventSource reconnects on its own.
export const maxDuration = 300;

const heartbeatMilliseconds = 25_000;

/** Streams new Messages of a Customer-owned Ticket as Server-Sent Events. */
export async function GET(request: Request, context: RouteContext<"/api/support/tickets/[ticketId]/events">) {
  const { ticketId: ticketIdParam } = await context.params;
  const ticketId = positiveIntegerField("Ticket ID").safeParse(ticketIdParam);
  if (!ticketId.success) return new Response("Not found", { status: 404 });

  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return new Response("Not found", { status: 404 });
  if (!(await createTicketStore(getDatabase()).get(ticketId.data, visitor.customer.userId))) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let stop = async () => {};
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // The stream was already closed by a disconnect.
        }
      };
      const unsubscribe = await subscribeToTicket(ticketId.data, (payload) => send(`data: ${JSON.stringify(payload)}\n\n`));
      const heartbeat = setInterval(() => send(": keep-alive\n\n"), heartbeatMilliseconds);
      let stopped = false;
      stop = async () => {
        if (stopped) return;
        stopped = true;
        clearInterval(heartbeat);
        try {
          await unsubscribe();
        } catch (error) {
          console.error("Ticket events unsubscribe failed", error);
        }
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      request.signal.addEventListener("abort", () => void stop());
      // Tells EventSource the stream is live so the page can catch up on anything it missed while reconnecting.
      send(": connected\n\n");
    },
    cancel: () => stop(),
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
