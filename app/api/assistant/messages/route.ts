import { z } from "zod";

import { answerOrderQuestion } from "@/lib/assistant/answer";
import { createChatStore } from "@/lib/assistant/chat-store";
import { createCompleter } from "@/lib/assistant/model";
import { maxMessageLength } from "@/lib/assistant/policy";
import { createOrderReader, createProductReader } from "@/lib/assistant/readers";
import { currentVisitor } from "@/lib/customer/current-visitor";
import { getDatabase } from "@/lib/db";
import { isSameOrigin } from "@/lib/security/same-origin";

export const runtime = "nodejs";

const id = z.number().int().positive().max(2_147_483_647).optional();
const body = z.object({
  message: z.string().max(maxMessageLength * 4),
  chatId: id,
  pageOrderId: id,
  pickedOrderId: id,
}).strict();

/** A signed-in Customer asks the Order assistant one question; it reads their own Orders and never changes anything. */
export async function POST(request: Request) {
  const visitor = await currentVisitor();
  if (visitor.state !== "customer") return Response.json({ error: "Sign in to use the assistant." }, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  let input: z.infer<typeof body>;
  try {
    input = body.parse(await request.json());
  } catch {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }
  const db = getDatabase();
  const reply = await answerOrderQuestion(
    { customerId: visitor.customer.userId, ...input },
    { orders: createOrderReader(db), products: createProductReader(db), chats: createChatStore(db), complete: createCompleter() },
  );
  return Response.json(reply);
}
