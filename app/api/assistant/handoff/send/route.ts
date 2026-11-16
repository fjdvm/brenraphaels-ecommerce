import { z } from "zod";

import { createHandoffStore, HandoffError, sendHandoff } from "@/lib/assistant-handoff/handoff";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { sendTicketCreatedEmail } from "@/lib/email/ticket-created-email";
import { scheduleStaffSignal } from "@/lib/notifications/staff-signal";
import { createTicketStore } from "@/lib/support/tickets";

export const runtime = "nodejs";

const body = z.object({
  chatId: z.number().int().positive().max(2_147_483_647),
  /** The Customer's own words, when they edited the summary or wrote one because it was dropped. */
  summary: z.string().max(4_000).optional(),
}).strict();

/** The Customer pressed "Send to our team": the one place a chat becomes a Ticket. */
export async function POST(request: Request) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await request.json());
  } catch {
    return Response.json({ error: "Send a chat." }, { status: 400 });
  }
  const tickets = createTicketStore(getDatabase());
  try {
    const { ticketId } = await sendHandoff(
      { customerId: visitor.customer.userId, chatId: input.chatId, summary: input.summary },
      { handoffs: createHandoffStore(getDatabase()), tickets },
    );
    scheduleStaffSignal("Ticket");
    try {
      const ticket = await tickets.get(ticketId, visitor.customer.userId);
      if (ticket) await sendTicketCreatedEmail(visitor.customer.email, ticket);
    } catch (error) {
      console.error("Ticket-created email could not be sent", error);
    }
    return Response.json({ ticketId });
  } catch (error) {
    if (error instanceof HandoffError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Sending the handoff failed", error);
    return Response.json({ error: "We couldn't send your note. Please try again." }, { status: 500 });
  }
}
