import { ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { creomsReturnCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { createReplacementOrders, ReplacementError } from "@/lib/orders/replacement-orders";
import { scheduleOrdersChanged } from "@/lib/orders/staff-signal";

export const runtime = "nodejs";

/** A Manager's one 24-hour extension of an Order's Refund window. A second extension is refused. */
export async function POST(request: Request, context: RouteContext<"/api/internal/orders/[id]/refund-window/extend">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsReturnCredential)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const orderId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(orderId)) return Response.json({ error: "Invalid Order id." }, { status: 400 });
  try {
    const { endsAt } = await createReplacementOrders(getDatabase()).extendWindow(orderId, await request.json());
    scheduleOrdersChanged();
    return Response.json({ orderId, endsAt: endsAt.toISOString() });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof ReplacementError) return Response.json({ error: error.message }, { status: error.message === "Order not found." ? 404 : 409 });
    return Response.json({ error: "The extension could not be confirmed. Refresh the Order before retrying." }, { status: 503 });
  }
}
