import { z } from "zod";

import { createChatStore } from "@/lib/assistant/chat-store";
import { createCompleter } from "@/lib/assistant/model";
import { createOrderReader } from "@/lib/assistant/readers";
import { createHandoffStore, HandoffError, prepareHandoff } from "@/lib/assistant-handoff/handoff";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { isSameOrigin } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const body = z.object({ chatId: z.number().int().positive().max(2_147_483_647) }).strict();

/**
 * The Customer asked to hand their chat to the team. This writes the Handoff summary and shows it to them; it opens no Ticket
 * and tells the team nothing. `POST /api/assistant/handoff/send` does that, only when the Customer presses "Send to our team".
 */
export async function POST(request: Request) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await request.json());
  } catch {
    return Response.json({ error: "Send a chat." }, { status: 400 });
  }
  const db = getDatabase();
  try {
    const draft = await prepareHandoff(
      { customerId: visitor.customer.userId, chatId: input.chatId },
      { orders: createOrderReader(db), chats: createChatStore(db), handoffs: createHandoffStore(db), complete: createCompleter() },
    );
    return Response.json(draft);
  } catch (error) {
    if (error instanceof HandoffError) return Response.json({ error: error.message }, { status: 404 });
    console.error("Handoff summary failed", error);
    return Response.json({ error: "We couldn't prepare your note. Please try again." }, { status: 500 });
  }
}
