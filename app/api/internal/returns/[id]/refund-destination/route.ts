import { ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { creomsReturnCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { changeRefundDestination, RefundDestinationError } from "@/lib/returns/change-refund-destination";

export const runtime = "nodejs";

/** A Manager's change to a locked Refund destination, before money is sent. CREOMS checks the Role; the storefront keeps the data. */
export async function POST(request: Request, context: RouteContext<"/api/internal/returns/[id]/refund-destination">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsReturnCredential)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const returnId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(returnId)) return Response.json({ error: "Invalid Return id." }, { status: 400 });
  try {
    const result = await changeRefundDestination(getDatabase())(returnId, await request.json());
    return Response.json({ returnId: result.returnId, changedAt: result.changedAt.toISOString() });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof RefundDestinationError) return Response.json({ error: error.message }, { status: error.message === "Return not found." ? 404 : 409 });
    return Response.json({ error: "The refund destination could not be confirmed. Refresh the Return before retrying." }, { status: 503 });
  }
}
