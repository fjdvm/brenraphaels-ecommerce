import { getDatabase } from "@/lib/db";
import { createTicketStore } from "@/lib/support/tickets";

export const runtime = "nodejs";

/** Scheduled by GitHub Actions every 15 minutes: sends On hold Tickets whose date has come back to Open. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const returned = await createTicketStore(getDatabase()).returnDueHolds(new Date());
  return Response.json({ returned });
}
