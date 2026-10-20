import { getDatabase } from "@/lib/db";
import { sendTicketAutoCompletedEmail } from "@/lib/email/ticket-auto-completed-email";
import { autoCompleteResolvedTicketsAndNotify, createTicketStore } from "@/lib/support/tickets";

export const runtime = "nodejs";

/** Daily Vercel Cron job; Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const completed = await autoCompleteResolvedTicketsAndNotify(new Date(), {
    ticketStore: createTicketStore(getDatabase()),
    mailer: { send: sendTicketAutoCompletedEmail },
  });
  return Response.json({ completed });
}
