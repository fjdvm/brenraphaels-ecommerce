import { ZodError } from "zod";

import { getDatabase } from "@/lib/db";
import { creomsReturnCredential, verifyCreomsCredential } from "@/lib/orders/creoms-credential";
import { parseInternalReturnStatusUpdate } from "@/lib/returns/internal-status";
import { InvalidRefundProof, verifyRefundProof } from "@/lib/returns/refund-proof";
import { createReturnStore, ReturnTransitionError } from "@/lib/returns/returns";

export const runtime = "nodejs";

export async function POST(request: Request, context: RouteContext<"/api/internal/returns/[id]/status">) {
  if (!verifyCreomsCredential(request.headers, new Date(), creomsReturnCredential)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await context.params;
  const returnId = Number(id);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(returnId)) {
    return Response.json({ error: "Invalid Return id." }, { status: 400 });
  }
  try {
    const { actor, decision } = parseInternalReturnStatusUpdate(await request.json());
    if (decision.status === "refunded") await verifyRefundProof(decision.refundProofFileId, returnId);
    const updated = await createReturnStore(getDatabase()).transition(returnId, actor, decision);
    return Response.json({
      id: updated.id, status: updated.status, finalResolution: updated.finalResolution,
      goodsRequired: updated.goodsRequired, declineReason: updated.declineReason,
      refundProofFileId: updated.refundProofFileId,
      actedBy: { id: updated.actedBy.id, name: updated.actedBy.name, at: updated.actedBy.at.toISOString() },
    });
  } catch (error) {
    if (error instanceof ZodError) return Response.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON body." }, { status: 400 });
    if (error instanceof InvalidRefundProof) return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof ReturnTransitionError) {
      return Response.json({ error: error.message }, { status: error.message === "Return not found." ? 404 : 409 });
    }
    // A failed commit acknowledgement can be uncertain. Never claim refusal or retry it automatically.
    return Response.json({ error: "Return decision could not be confirmed. Refresh before retrying." }, { status: 503 });
  }
}
