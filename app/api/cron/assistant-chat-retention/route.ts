import { createChatStore } from "@/lib/assistant/chat-store";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

/** Daily job: deletes Order assistant chats past the fixed retention unless they are attached to a Ticket. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return Response.json({ deleted: await createChatStore(getDatabase()).deleteExpired(new Date()) });
}
