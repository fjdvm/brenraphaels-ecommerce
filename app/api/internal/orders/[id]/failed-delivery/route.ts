import { after } from "next/server";
import { ZodError } from "zod";
import { getDatabase } from "@/lib/db";
import { verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createFailedDeliveries, FailedDeliveryError } from "@/lib/orders/failed-deliveries";
import { createStockReservations } from "@/lib/orders/stock-reservations";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";

export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/failed-delivery">) {
  if (!verifyCreomsCredential(request.headers)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({ error: "Invalid Order id." }, { status: 400 });
  try {
    const result = await createFailedDeliveries(getDatabase()).change(id, await request.json());
    scheduleOrdersChanged();
    after(async () => { await createStockReservations(getDatabase()).sendPending(); });
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof FailedDeliveryError) return Response.json({ error: error.message }, { status: 409 });
    return Response.json({ error: "Failed delivery could not be confirmed. Refresh the Order before retrying." }, { status: 503 });
  }
}
